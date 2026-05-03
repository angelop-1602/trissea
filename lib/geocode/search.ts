export interface GeocodePoint {
  latitude: number;
  longitude: number;
}

export interface GeocodeSearchResult extends GeocodePoint {
  label: string;
}

export interface SearchViewbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

const EARTH_RADIUS_METERS = 6371000;
const KM_PER_LATITUDE_DEGREE = 111.32;
const CACHE_COORDINATE_DECIMALS = 2;
const SEARCH_CACHE_VERSION = 'v5';
const QUERY_REPLACEMENTS: Record<string, string> = {
  st: 'saint',
};

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildProviderSearchQuery(query: string) {
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => QUERY_REPLACEMENTS[token] ?? token)
    .join(' ');
}

export function parseCoordinate(value: string | null, min: number, max: number) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

export function parseSearchBias(params: URLSearchParams): GeocodePoint | null {
  const latitude = parseCoordinate(params.get('latitude'), -90, 90);
  const longitude = parseCoordinate(params.get('longitude'), -180, 180);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

export function buildSearchViewbox(center: GeocodePoint, radiusKm: number): SearchViewbox {
  const safeRadiusKm = Math.max(0, radiusKm);
  const latitudeDelta = safeRadiusKm / KM_PER_LATITUDE_DEGREE;
  const latitudeRadians = toRadians(center.latitude);
  const longitudeScale = Math.max(0.01, Math.cos(latitudeRadians));
  const longitudeDelta = safeRadiusKm / (KM_PER_LATITUDE_DEGREE * longitudeScale);

  return {
    west: clamp(center.longitude - longitudeDelta, -180, 180),
    south: clamp(center.latitude - latitudeDelta, -90, 90),
    east: clamp(center.longitude + longitudeDelta, -180, 180),
    north: clamp(center.latitude + latitudeDelta, -90, 90),
  };
}

export function formatSearchViewbox(viewbox: SearchViewbox) {
  return [viewbox.west, viewbox.south, viewbox.east, viewbox.north]
    .map((value) => value.toFixed(6))
    .join(',');
}

export function getDistanceMeters(left: GeocodePoint, right: GeocodePoint) {
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const normalizedHaversine = Math.min(1, Math.max(0, haversine));

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(normalizedHaversine), Math.sqrt(1 - normalizedHaversine));
}

export function sortResultsByDistance<T extends GeocodePoint>(results: T[], bias: GeocodePoint) {
  return [...results].sort((left, right) => getDistanceMeters(left, bias) - getDistanceMeters(right, bias));
}

function getSearchTokens(query: string) {
  return buildProviderSearchQuery(query).split(/\s+/).filter(Boolean);
}

function getLabelTokens(label: string) {
  return normalizeSearchText(label).split(/\s+/).filter(Boolean);
}

function getResultRelevanceScore(result: GeocodeSearchResult, query: string) {
  const queryTokens = getSearchTokens(query);
  if (queryTokens.length === 0) return 0;

  const labelTokens = getLabelTokens(result.label);
  let score = 0;

  for (const queryToken of queryTokens) {
    let tokenScore = 0;

    for (const labelToken of labelTokens) {
      if (labelToken === queryToken) {
        tokenScore = Math.max(tokenScore, 4);
      } else if (labelToken.startsWith(queryToken)) {
        tokenScore = Math.max(tokenScore, 2);
      } else if (queryToken.length >= 4 && labelToken.includes(queryToken)) {
        tokenScore = Math.max(tokenScore, 1);
      }
    }

    if (tokenScore === 0) {
      return 0;
    }

    score += tokenScore;
  }

  if (normalizeSearchText(result.label).startsWith(buildProviderSearchQuery(query))) {
    score += 3;
  }

  return score;
}

export function rankSearchResults(results: GeocodeSearchResult[], query: string, bias: GeocodePoint | null) {
  return dedupeSearchResults(results)
    .map((result) => ({
      result,
      score: getResultRelevanceScore(result, query),
      distance: bias ? getDistanceMeters(result, bias) : 0,
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.distance - right.distance;
    })
    .map((item) => item.result);
}

export function dedupeSearchResults(results: GeocodeSearchResult[]) {
  const seen = new Set<string>();
  const output: GeocodeSearchResult[] = [];

  for (const result of results) {
    const label = result.label.trim();
    if (!label || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
      continue;
    }

    const key = `${label.toLowerCase()}|${result.latitude.toFixed(5)},${result.longitude.toFixed(5)}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push({ ...result, label });
  }

  return output;
}

export function buildSearchCacheKey(query: string, bias: GeocodePoint | null) {
  const normalizedQuery = buildProviderSearchQuery(query) || normalizeQuery(query);
  if (!bias) {
    return `${SEARCH_CACHE_VERSION}|${normalizedQuery}|global`;
  }

  return `${SEARCH_CACHE_VERSION}|${normalizedQuery}|bias=${bias.latitude.toFixed(CACHE_COORDINATE_DECIMALS)},${bias.longitude.toFixed(
    CACHE_COORDINATE_DECIMALS
  )}`;
}
