export type RouteCoordinate = [number, number];

export type RoadRouteProvider = 'graphhopper' | 'osrm';

export type RoadRouteErrorCode = 'ROUTING_UNAVAILABLE' | 'ROUTING_EMPTY' | 'ROUTING_RESTRICTED';

export interface RoadRouteResult {
  coordinates: RouteCoordinate[];
  distanceKm: number;
  estimatedDurationMin: number;
  provider: RoadRouteProvider;
}

export class RoadRouteError extends Error {
  readonly status: number;
  readonly code: RoadRouteErrorCode;

  constructor(message: string, status: number, code: RoadRouteErrorCode) {
    super(message);
    this.name = 'RoadRouteError';
    this.status = status;
    this.code = code;
  }
}

type RoutingProviderSetting = 'auto' | 'graphhopper' | 'osrm';

interface GraphHopperRouteResponse {
  message?: string;
  paths?: Array<{
    distance?: number;
    time?: number;
    points?: {
      coordinates?: RouteCoordinate[];
    };
    details?: {
      road_access?: unknown[];
      road_class?: unknown[];
    };
  }>;
}

interface OsrmRouteResponse {
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: RouteCoordinate[];
    };
  }>;
}

const DEFAULT_GRAPHHOPPER_ROUTE_URL = 'https://graphhopper.com/api/1/route';
const DEFAULT_OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';
const RESTRICTED_ROAD_ACCESS_VALUES = new Set(['no', 'private']);
const DEFAULT_DISALLOWED_ROAD_CLASSES = ['track', 'path', 'footway', 'pedestrian', 'steps'];
const DEFAULT_MAX_DISALLOWED_ROAD_CLASS_METERS = 30;

function readEnv(key: string) {
  return process.env[key]?.trim() ?? '';
}

function readCsvEnv(key: string, fallback: string[]) {
  const value = readEnv(key);
  if (!value) {
    return fallback;
  }

  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function readNumberEnv(key: string, fallback: number) {
  const rawValue = readEnv(key);
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readRoutingProviderSetting(): RoutingProviderSetting {
  const value = readEnv('ROUTING_PROVIDER').toLowerCase();
  if (value === 'graphhopper' || value === 'osrm') {
    return value;
  }

  return 'auto';
}

function getGraphHopperRouteUrl() {
  return readEnv('GRAPHHOPPER_ROUTE_URL') || DEFAULT_GRAPHHOPPER_ROUTE_URL;
}

function hasCustomGraphHopperRouteUrl() {
  return Boolean(readEnv('GRAPHHOPPER_ROUTE_URL'));
}

export function isGraphHopperRoutingConfigured() {
  return Boolean(readEnv('GRAPHHOPPER_API_KEY') || hasCustomGraphHopperRouteUrl());
}

export function parseRouteCoordinatePair(input: string): RouteCoordinate | null {
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

export function parseRouteCoordinates(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(';')
    .map((item) => item.trim())
    .map(parseRouteCoordinatePair)
    .filter((item): item is RouteCoordinate => item !== null);
}

export function buildRoadRouteCacheKey(coordinates: RouteCoordinate[]) {
  const provider = readRoutingProviderSetting();
  const resolvedProvider = provider === 'auto' ? (isGraphHopperRoutingConfigured() ? 'graphhopper' : 'osrm') : provider;
  const disallowedClasses = readDisallowedRoadClasses().join(',');
  const maxDisallowedMeters = readMaxDisallowedRoadClassMeters();
  return coordinates
    .map(([longitude, latitude]) => `${longitude.toFixed(5)},${latitude.toFixed(5)}`)
    .join(';')
    .concat(`|provider=${resolvedProvider}|classes=${disallowedClasses}|max=${maxDisallowedMeters}`);
}

function coordinatesToOsrmPath(coordinates: RouteCoordinate[]) {
  return coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`).join(';');
}

function assertRouteCoordinates(coordinates: unknown): asserts coordinates is RouteCoordinate[] {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new RoadRouteError('No public road route was found for these points.', 502, 'ROUTING_EMPTY');
  }
}

function readDisallowedRoadClasses() {
  return readCsvEnv('ROUTING_DISALLOWED_ROAD_CLASSES', DEFAULT_DISALLOWED_ROAD_CLASSES);
}

function readMaxDisallowedRoadClassMeters() {
  return readNumberEnv('ROUTING_MAX_DISALLOWED_ROAD_CLASS_METERS', DEFAULT_MAX_DISALLOWED_ROAD_CLASS_METERS);
}

function getRouteSegmentDistanceMeters(coordinates: RouteCoordinate[], startIndex: number, endIndex: number) {
  let distanceMeters = 0;
  const safeStart = Math.max(0, startIndex);
  const safeEnd = Math.min(coordinates.length - 1, endIndex);

  for (let index = safeStart + 1; index <= safeEnd; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];

    if (!previous || !current) {
      continue;
    }

    distanceMeters += getCoordinateDistanceMeters(previous, current);
  }

  return distanceMeters;
}

function getCoordinateDistanceMeters(left: RouteCoordinate, right: RouteCoordinate) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(right[1] - left[1]);
  const longitudeDelta = toRadians(right[0] - left[0]);
  const leftLatitude = toRadians(left[1]);
  const rightLatitude = toRadians(right[1]);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const normalized = Math.min(1, Math.max(0, haversine));

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(normalized), Math.sqrt(1 - normalized));
}

function getRestrictedRoadClassValues(path: NonNullable<GraphHopperRouteResponse['paths']>[number]) {
  const roadClass = path.details?.road_class;
  const coordinates = path.points?.coordinates;
  if (!Array.isArray(roadClass) || !Array.isArray(coordinates)) {
    return [];
  }

  const disallowedClasses = new Set(readDisallowedRoadClasses());
  if (disallowedClasses.size === 0) {
    return [];
  }

  const maxAllowedMeters = readMaxDisallowedRoadClassMeters();
  const restricted = new Set<string>();

  for (const segment of roadClass) {
    if (!Array.isArray(segment) || segment.length < 3) {
      continue;
    }

    const value = String(segment[2] ?? '').trim().toLowerCase();
    if (!disallowedClasses.has(value)) {
      continue;
    }

    const startIndex = Number(segment[0]);
    const endIndex = Number(segment[1]);
    if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) {
      restricted.add(value);
      continue;
    }

    if (getRouteSegmentDistanceMeters(coordinates, startIndex, endIndex) > maxAllowedMeters) {
      restricted.add(value);
    }
  }

  return [...restricted];
}

function getRestrictedRoadAccessValues(path: NonNullable<GraphHopperRouteResponse['paths']>[number]) {
  const roadAccess = path.details?.road_access;
  if (!Array.isArray(roadAccess)) {
    return [];
  }

  const restricted = new Set<string>();
  for (const segment of roadAccess) {
    if (!Array.isArray(segment) || segment.length < 3) {
      continue;
    }

    const value = String(segment[2] ?? '').trim().toLowerCase();
    if (RESTRICTED_ROAD_ACCESS_VALUES.has(value)) {
      restricted.add(value);
    }
  }

  return [...restricted];
}

function readGraphHopperPath(response: GraphHopperRouteResponse) {
  const path = response.paths?.[0];
  if (!path) {
    throw new RoadRouteError(response.message ?? 'No public road route was found for these points.', 502, 'ROUTING_EMPTY');
  }

  const restrictedValues = getRestrictedRoadAccessValues(path);
  if (restrictedValues.length > 0) {
    throw new RoadRouteError(
      'Route uses a restricted or private road. Move the pin to a public road or choose another destination.',
      422,
      'ROUTING_RESTRICTED'
    );
  }

  const coordinates = path.points?.coordinates;
  assertRouteCoordinates(coordinates);

  const restrictedRoadClasses = getRestrictedRoadClassValues(path);
  if (restrictedRoadClasses.length > 0) {
    throw new RoadRouteError(
      'Route uses a restricted or private road. Move the pin to a public road or choose another destination.',
      422,
      'ROUTING_RESTRICTED'
    );
  }

  return {
    coordinates,
    distanceKm: Number(((path.distance ?? 0) / 1000).toFixed(2)),
    estimatedDurationMin: Math.max(1, Math.ceil((path.time ?? 0) / 60_000)),
    provider: 'graphhopper' as const,
  };
}

async function fetchGraphHopperRoadRoute(coordinates: RouteCoordinate[]): Promise<RoadRouteResult> {
  if (!isGraphHopperRoutingConfigured()) {
    throw new RoadRouteError(
      'GraphHopper routing requires GRAPHHOPPER_API_KEY or GRAPHHOPPER_ROUTE_URL.',
      503,
      'ROUTING_UNAVAILABLE'
    );
  }

  let url: URL;
  try {
    url = new URL(getGraphHopperRouteUrl());
  } catch {
    throw new RoadRouteError('GraphHopper route URL is invalid.', 503, 'ROUTING_UNAVAILABLE');
  }

  for (const [longitude, latitude] of coordinates) {
    url.searchParams.append('point', `${latitude},${longitude}`);
  }
  url.searchParams.set('profile', readEnv('GRAPHHOPPER_PROFILE') || 'car');
  url.searchParams.set('locale', 'en');
  url.searchParams.set('calc_points', 'true');
  url.searchParams.set('points_encoded', 'false');
  url.searchParams.set('instructions', 'false');
  url.searchParams.append('details', 'road_access');
  url.searchParams.append('details', 'road_class');

  const apiKey = readEnv('GRAPHHOPPER_API_KEY');
  if (apiKey) {
    url.searchParams.set('key', apiKey);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new RoadRouteError('GraphHopper routing is currently unreachable.', 502, 'ROUTING_UNAVAILABLE');
  }

  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? 'GraphHopper routing key is missing or invalid.'
        : 'GraphHopper routing is currently unavailable.';
    throw new RoadRouteError(message, 502, 'ROUTING_UNAVAILABLE');
  }

  try {
    return readGraphHopperPath((await response.json()) as GraphHopperRouteResponse);
  } catch (error) {
    if (error instanceof RoadRouteError) {
      throw error;
    }

    throw new RoadRouteError('GraphHopper returned an invalid routing response.', 502, 'ROUTING_UNAVAILABLE');
  }
}

async function fetchOsrmRoadRoute(coordinates: RouteCoordinate[]): Promise<RoadRouteResult> {
  const routeBaseUrl = readEnv('OSRM_ROUTE_URL') || DEFAULT_OSRM_ROUTE_URL;
  const url = `${routeBaseUrl}/${coordinatesToOsrmPath(coordinates)}?overview=full&geometries=geojson&steps=false`;
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new RoadRouteError('Road routing service is currently unreachable.', 502, 'ROUTING_UNAVAILABLE');
  }

  if (!response.ok) {
    throw new RoadRouteError('Road routing service is currently unavailable.', 502, 'ROUTING_UNAVAILABLE');
  }

  let data: OsrmRouteResponse;
  try {
    data = (await response.json()) as OsrmRouteResponse;
  } catch {
    throw new RoadRouteError('Road routing service returned an invalid response.', 502, 'ROUTING_UNAVAILABLE');
  }

  const route = data.routes?.[0];
  const coordinatesResult = route?.geometry?.coordinates;
  assertRouteCoordinates(coordinatesResult);

  return {
    coordinates: coordinatesResult,
    distanceKm: Number(((route?.distance ?? 0) / 1000).toFixed(2)),
    estimatedDurationMin: Math.max(1, Math.ceil((route?.duration ?? 0) / 60)),
    provider: 'osrm',
  };
}

function shouldFallbackToOsrm() {
  return readEnv('ROUTING_ALLOW_OSRM_FALLBACK').toLowerCase() === 'true';
}

async function fetchGraphHopperWithOptionalFallback(coordinates: RouteCoordinate[]) {
  try {
    return await fetchGraphHopperRoadRoute(coordinates);
  } catch (error) {
    if (error instanceof RoadRouteError && error.code === 'ROUTING_RESTRICTED') {
      throw error;
    }

    if (shouldFallbackToOsrm()) {
      return fetchOsrmRoadRoute(coordinates);
    }

    throw error;
  }
}

export async function resolveRoadRoute(coordinates: RouteCoordinate[]): Promise<RoadRouteResult> {
  if (coordinates.length < 2) {
    throw new RoadRouteError('At least two valid coordinate pairs are required.', 400, 'ROUTING_EMPTY');
  }

  const provider = readRoutingProviderSetting();
  if (provider === 'osrm') {
    return fetchOsrmRoadRoute(coordinates);
  }

  if (provider === 'graphhopper') {
    return fetchGraphHopperWithOptionalFallback(coordinates);
  }

  if (!isGraphHopperRoutingConfigured()) {
    return fetchOsrmRoadRoute(coordinates);
  }

  return fetchGraphHopperWithOptionalFallback(coordinates);
}
