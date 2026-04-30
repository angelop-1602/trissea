import { NextRequest, NextResponse } from 'next/server';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';

const CACHE_TTL_MS = 60_000;
const MAX_RESULTS = 5;

interface SearchItem {
  display_name?: string;
  lat?: string;
  lon?: string;
}

type SearchCacheEntry = {
  items: Array<{
    label: string;
    latitude: number;
    longitude: number;
  }>;
  expiresAt: number;
};

const globalForSearchCache = globalThis as unknown as {
  __trisseaGeocodeSearchCache: Map<string, SearchCacheEntry> | undefined;
};

const searchCache =
  globalForSearchCache.__trisseaGeocodeSearchCache ??
  (globalForSearchCache.__trisseaGeocodeSearchCache = new Map<string, SearchCacheEntry>());

function normalizeLabel(displayName: string): string {
  return displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
}

export async function GET(request: NextRequest) {
  const limit = await checkEndpointRateLimit(request, {
    scope: 'geocode.search',
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

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      { results: cached.items },
      {
        headers: {
          'x-cache': 'hit',
        },
      }
    );
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', query);
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(MAX_RESULTS));
  url.searchParams.set('countrycodes', 'ph');

  try {
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'TRISSEABooking/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Search service unavailable.' }, { status: 502 });
    }

    const payload = (await response.json()) as SearchItem[];
    const results = payload
      .map((item) => ({
        label: item.display_name ? normalizeLabel(item.display_name) : '',
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      }))
      .filter((item) => item.label.length > 0 && Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

    searchCache.set(cacheKey, {
      items: results,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(
      { results },
      {
        headers: {
          'x-cache': 'miss',
        },
      }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to search addresses.' }, { status: 502 });
  }
}

