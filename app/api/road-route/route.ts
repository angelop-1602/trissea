import { NextRequest, NextResponse } from 'next/server';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';

const CACHE_TTL_MS = 30_000;

type RouteCacheEntry = {
  coordinates: [number, number][];
  expiresAt: number;
};

const globalForRoadRouteCache = globalThis as unknown as {
  __mobilityRoadRouteCache: Map<string, RouteCacheEntry> | undefined;
};

const roadRouteCache =
  globalForRoadRouteCache.__mobilityRoadRouteCache ??
  (globalForRoadRouteCache.__mobilityRoadRouteCache = new Map<string, RouteCacheEntry>());

interface OsrmRouteResponse {
  routes?: Array<{
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
}

function parseCoordinatePair(input: string): [number, number] | null {
  const [longitudeRaw, latitudeRaw] = input.split(',');
  const longitude = Number(longitudeRaw);
  const latitude = Number(latitudeRaw);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    return null;
  }

  return [longitude, latitude];
}

export async function GET(request: NextRequest) {
  const limit = await checkEndpointRateLimit(request, {
    scope: 'road.route',
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

  const coordinatesParam = request.nextUrl.searchParams.get('coordinates');

  if (!coordinatesParam) {
    return NextResponse.json(
      { error: 'Missing required "coordinates" query parameter.' },
      { status: 400 }
    );
  }

  const coordinates = coordinatesParam
    .split(';')
    .map((item) => item.trim())
    .map(parseCoordinatePair)
    .filter((item): item is [number, number] => item !== null);

  if (coordinates.length < 2) {
    return NextResponse.json(
      { error: 'At least two valid coordinate pairs are required.' },
      { status: 400 }
    );
  }

  const cacheKey = coordinates
    .map(([longitude, latitude]) => `${longitude.toFixed(5)},${latitude.toFixed(5)}`)
    .join(';');

  const cached = roadRouteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      { coordinates: cached.coordinates },
      {
        headers: {
          'x-cache': 'hit',
        },
      }
    );
  }

  const coordinateString = coordinates
    .map(([longitude, latitude]) => `${longitude},${latitude}`)
    .join(';');

  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson&steps=false`;

  try {
    const response = await fetch(osrmUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Road routing service is currently unavailable.' },
        { status: 502 }
      );
    }

    const data = (await response.json()) as OsrmRouteResponse;
    const routedCoordinates = data.routes?.[0]?.geometry?.coordinates;

    if (!Array.isArray(routedCoordinates) || routedCoordinates.length < 2) {
      return NextResponse.json(
        { error: 'No route geometry returned by routing service.' },
        { status: 502 }
      );
    }

    roadRouteCache.set(cacheKey, {
      coordinates: routedCoordinates,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(
      { coordinates: routedCoordinates },
      {
        headers: {
          'x-cache': 'miss',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to resolve road-following route.' },
      { status: 502 }
    );
  }
}

