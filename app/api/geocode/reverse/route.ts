import { NextRequest, NextResponse } from 'next/server';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';

const CACHE_TTL_MS = 60_000;

type ReverseCacheEntry = {
  label: string;
  expiresAt: number;
};

const globalForReverseGeocodeCache = globalThis as unknown as {
  __trisseaReverseGeocodeCache: Map<string, ReverseCacheEntry> | undefined;
};

const reverseGeocodeCache =
  globalForReverseGeocodeCache.__trisseaReverseGeocodeCache ??
  (globalForReverseGeocodeCache.__trisseaReverseGeocodeCache = new Map<string, ReverseCacheEntry>());

interface NominatimReverseResponse {
  display_name?: string;
  address?: Record<string, string | undefined>;
}

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function compactUnique(parts: Array<string | undefined | null>) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const part of parts) {
    const normalized = part?.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function buildStreetLabel(payload: NominatimReverseResponse): string | null {
  const address = payload.address ?? {};

  const road =
    address.road ??
    address.pedestrian ??
    address.cycleway ??
    address.footway ??
    address.path ??
    address.neighbourhood;

  const street = road
    ? compactUnique([address.house_number ? `${address.house_number} ${road}` : road])[0]
    : null;

  const locality = address.suburb ?? address.city_district ?? address.village ?? address.town ?? address.city;
  const city = address.city ?? address.town ?? address.village ?? address.municipality;
  const province = address.state ?? address.region;

  const composed = compactUnique([street, locality, city, province]);
  if (composed.length > 0) {
    return composed.slice(0, 3).join(', ');
  }

  if (payload.display_name) {
    const parts = payload.display_name
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.slice(0, 3).join(', ');
    }
  }

  return null;
}

function toCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

export async function GET(request: NextRequest) {
  const limit = await checkEndpointRateLimit(request, {
    scope: 'geocode.reverse',
    limit: 90,
    windowMs: 60_000,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please retry later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.retryAfterSeconds),
        },
      }
    );
  }

  const latitude = parseCoordinate(request.nextUrl.searchParams.get('latitude'), -90, 90);
  const longitude = parseCoordinate(request.nextUrl.searchParams.get('longitude'), -180, 180);

  if (latitude === null || longitude === null) {
    return NextResponse.json(
      { error: 'Valid latitude and longitude query parameters are required.' },
      { status: 400 }
    );
  }

  const cacheKey = toCacheKey(latitude, longitude);
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      { label: cached.label },
      {
        headers: {
          'x-cache': 'hit',
        },
      }
    );
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'TRISSEABooking/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Reverse geocoding service unavailable.' }, { status: 502 });
    }

    const payload = (await response.json()) as NominatimReverseResponse;
    const label = buildStreetLabel(payload);

    if (!label) {
      return NextResponse.json({ error: 'No street label found for location.' }, { status: 404 });
    }

    reverseGeocodeCache.set(cacheKey, {
      label,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(
      { label },
      {
        headers: {
          'x-cache': 'miss',
        },
      }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to reverse geocode location.' }, { status: 502 });
  }
}

