import { NextRequest, NextResponse } from 'next/server';
import {
  buildProviderSearchQuery,
  buildSearchCacheKey,
  buildSearchViewbox,
  dedupeSearchResults,
  formatSearchViewbox,
  parseSearchBias,
  rankSearchResults,
  type GeocodePoint,
  type GeocodeSearchResult,
} from '@/lib/geocode/search';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';

const CACHE_TTL_MS = 60_000;
const MAX_RESULTS = 5;
const LOCAL_BIAS_RADIUS_KM = 40;
const MIN_SEARCH_LENGTH = 3;

interface NominatimSearchItem {
  display_name?: string;
  lat?: string;
  lon?: string;
}

interface PhotonSearchFeature {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: {
    name?: string;
    street?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

interface PhotonSearchResponse {
  features?: PhotonSearchFeature[];
}

type SearchCacheEntry = {
  items: GeocodeSearchResult[];
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

function buildNominatimUrl(query: string, options?: { bias: GeocodePoint; radiusKm: number }) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', query);
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(MAX_RESULTS));
  url.searchParams.set('countrycodes', 'ph');

  if (options) {
    url.searchParams.set('viewbox', formatSearchViewbox(buildSearchViewbox(options.bias, options.radiusKm)));
    url.searchParams.set('bounded', '1');
  }

  return url;
}

function buildPhotonUrl(query: string, options?: { bias: GeocodePoint; radiusKm: number }) {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(MAX_RESULTS));
  url.searchParams.set('lang', 'en');

  if (options) {
    const viewbox = buildSearchViewbox(options.bias, options.radiusKm);
    url.searchParams.set('lat', options.bias.latitude.toString());
    url.searchParams.set('lon', options.bias.longitude.toString());
    url.searchParams.set('bbox', formatSearchViewbox(viewbox));
  }

  return url;
}

function compactUnique(parts: Array<string | undefined | null>) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const part of parts) {
    const value = part?.trim();
    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(value);
  }

  return output;
}

function normalizeNominatimResults(payload: NominatimSearchItem[]) {
  return dedupeSearchResults(
    payload.map((item) => ({
      label: item.display_name ? normalizeLabel(item.display_name) : '',
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    }))
  );
}

function normalizePhotonResults(payload: PhotonSearchResponse) {
  const features = Array.isArray(payload.features) ? payload.features : [];

  return dedupeSearchResults(
    features.map((feature) => {
      const coordinates = feature.geometry?.coordinates;
      const longitude = Array.isArray(coordinates) ? Number(coordinates[0]) : Number.NaN;
      const latitude = Array.isArray(coordinates) ? Number(coordinates[1]) : Number.NaN;
      const properties = feature.properties ?? {};
      const label = compactUnique([
        properties.name,
        properties.street,
        properties.city ?? properties.county,
      ])
        .slice(0, 4)
        .join(', ');

      return { label, latitude, longitude };
    })
  );
}

async function fetchNominatimResults(query: string, options?: { bias: GeocodePoint; radiusKm: number }) {
  const response = await fetch(buildNominatimUrl(query, options).toString(), {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'TRISSEABooking/1.0',
    },
  });

  if (!response.ok) {
    throw new Error('Search service unavailable.');
  }

  return normalizeNominatimResults((await response.json()) as NominatimSearchItem[]);
}

async function fetchPhotonResults(query: string, options?: { bias: GeocodePoint; radiusKm: number }) {
  const response = await fetch(buildPhotonUrl(query, options).toString(), {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'TRISSEABooking/1.0',
    },
  });

  if (!response.ok) {
    throw new Error('Fallback search service unavailable.');
  }

  return normalizePhotonResults((await response.json()) as PhotonSearchResponse);
}

async function fetchProviderResults(query: string, options?: { bias: GeocodePoint; radiusKm: number }) {
  const providerResults: GeocodeSearchResult[] = [];

  try {
    const nominatimResults = await fetchNominatimResults(query, options);
    providerResults.push(...nominatimResults);
  } catch {
    // Nominatim can throttle autocomplete-style searches; try the fallback provider below.
  }

  try {
    providerResults.push(...(await fetchPhotonResults(query, options)));
  } catch {
    // Keep any primary provider results. The caller handles an empty array.
  }

  return rankSearchResults(providerResults, query, options?.bias ?? null);
}

async function searchWithLocalBias(query: string, bias: GeocodePoint) {
  const results = await fetchProviderResults(query, { bias, radiusKm: LOCAL_BIAS_RADIUS_KM });
  return results.slice(0, MAX_RESULTS);
}

async function searchWithoutBias(query: string) {
  return (await fetchProviderResults(query)).slice(0, MAX_RESULTS);
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

  const rawQuery = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const query = buildProviderSearchQuery(rawQuery);
  if (query.length < MIN_SEARCH_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  const bias = parseSearchBias(request.nextUrl.searchParams);
  const cacheKey = buildSearchCacheKey(rawQuery, bias);
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

  try {
    const results = bias ? await searchWithLocalBias(query, bias) : await searchWithoutBias(query);

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
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'x-geocode-status': 'unavailable',
        },
      }
    );
  }
}

