import { NextRequest, NextResponse } from 'next/server';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';
import {
  buildRoadRouteCacheKey,
  parseRouteCoordinates,
  resolveRoadRoute,
  RoadRouteError,
  type RoadRouteProvider,
  type RouteCoordinate,
} from '@/lib/routing/road-route';

const CACHE_TTL_MS = 30_000;

type RouteCacheEntry = {
  coordinates: RouteCoordinate[];
  provider: RoadRouteProvider;
  expiresAt: number;
};

const globalForRoadRouteCache = globalThis as unknown as {
  __trisseaRoadRouteCache: Map<string, RouteCacheEntry> | undefined;
};

const roadRouteCache =
  globalForRoadRouteCache.__trisseaRoadRouteCache ??
  (globalForRoadRouteCache.__trisseaRoadRouteCache = new Map<string, RouteCacheEntry>());

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

  const coordinates = parseRouteCoordinates(coordinatesParam);

  if (coordinates.length < 2) {
    return NextResponse.json(
      { error: 'At least two valid coordinate pairs are required.' },
      { status: 400 }
    );
  }

  const cacheKey = buildRoadRouteCacheKey(coordinates);

  const cached = roadRouteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      { coordinates: cached.coordinates },
      {
        headers: {
          'x-cache': 'hit',
          'x-routing-provider': cached.provider,
        },
      }
    );
  }

  try {
    const route = await resolveRoadRoute(coordinates);

    roadRouteCache.set(cacheKey, {
      coordinates: route.coordinates,
      provider: route.provider,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(
      { coordinates: route.coordinates },
      {
        headers: {
          'x-cache': 'miss',
          'x-routing-provider': route.provider,
        },
      }
    );
  } catch (error) {
    if (error instanceof RoadRouteError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Failed to resolve road-following route.' },
      { status: 502 }
    );
  }
}

