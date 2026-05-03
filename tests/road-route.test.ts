import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRoadRouteCacheKey,
  parseRouteCoordinatePair,
  parseRouteCoordinates,
  resolveRoadRoute,
  RoadRouteError,
} from '@/lib/routing/road-route';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function restoreRuntime() {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
}

test.afterEach(() => {
  restoreRuntime();
});

test('route coordinate parsing rejects invalid pairs', () => {
  assert.deepEqual(parseRouteCoordinatePair('121.72,17.61'), [121.72, 17.61]);
  assert.equal(parseRouteCoordinatePair('181,17.61'), null);
  assert.equal(parseRouteCoordinatePair('121.72,not-a-number'), null);
  assert.deepEqual(parseRouteCoordinates('121.72,17.61;bad;121.73,17.62'), [
    [121.72, 17.61],
    [121.73, 17.62],
  ]);
});

test('road route cache key includes selected routing provider', () => {
  process.env.ROUTING_PROVIDER = 'graphhopper';

  assert.equal(
    buildRoadRouteCacheKey([
      [121.72132, 17.615],
      [121.7268, 17.6136],
    ]),
    '121.72132,17.61500;121.72680,17.61360|provider=graphhopper|classes=track,path,footway,pedestrian,steps|max=30'
  );
});

test('road route cache key resolves auto provider to OSRM when GraphHopper is not configured', () => {
  process.env.ROUTING_PROVIDER = 'auto';
  delete process.env.GRAPHHOPPER_API_KEY;
  delete process.env.GRAPHHOPPER_ROUTE_URL;

  assert.equal(
    buildRoadRouteCacheKey([
      [121.72132, 17.615],
      [121.7268, 17.6136],
    ]),
    '121.72132,17.61500;121.72680,17.61360|provider=osrm|classes=track,path,footway,pedestrian,steps|max=30'
  );
});

test('GraphHopper route rejects private road access details', async () => {
  process.env.ROUTING_PROVIDER = 'graphhopper';
  process.env.GRAPHHOPPER_ROUTE_URL = 'https://routing.example.test/route';
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        paths: [
          {
            distance: 1000,
            time: 120000,
            points: {
              coordinates: [
                [121.72, 17.61],
                [121.73, 17.62],
              ],
            },
            details: {
              road_access: [[0, 1, 'private']],
            },
          },
        ],
      }),
      { status: 200 }
    );

  await assert.rejects(
    resolveRoadRoute([
      [121.72, 17.61],
      [121.73, 17.62],
    ]),
    (error) =>
      error instanceof RoadRouteError &&
      error.code === 'ROUTING_RESTRICTED' &&
      error.status === 422
  );
});

test('GraphHopper provider can fall back to OSRM when routing is unreachable', async () => {
  process.env.ROUTING_PROVIDER = 'graphhopper';
  process.env.GRAPHHOPPER_ROUTE_URL = 'https://routing.example.test/route';
  process.env.ROUTING_ALLOW_OSRM_FALLBACK = 'true';
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith('https://routing.example.test')) {
      throw new TypeError('fetch failed');
    }

    return new Response(
      JSON.stringify({
        routes: [
          {
            distance: 1500,
            duration: 360,
            geometry: {
              coordinates: [
                [121.72, 17.61],
                [121.73, 17.62],
              ],
            },
          },
        ],
      }),
      { status: 200 }
    );
  };

  const route = await resolveRoadRoute([
    [121.72, 17.61],
    [121.73, 17.62],
  ]);

  assert.equal(route.provider, 'osrm');
  assert.equal(route.distanceKm, 1.5);
  assert.equal(route.estimatedDurationMin, 6);
});

test('GraphHopper route rejects long disallowed road class segments', async () => {
  process.env.ROUTING_PROVIDER = 'graphhopper';
  process.env.GRAPHHOPPER_ROUTE_URL = 'https://routing.example.test/route';
  process.env.ROUTING_DISALLOWED_ROAD_CLASSES = 'service';
  process.env.ROUTING_MAX_DISALLOWED_ROAD_CLASS_METERS = '30';
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        paths: [
          {
            distance: 140,
            time: 60000,
            points: {
              coordinates: [
                [121.72, 17.61],
                [121.7209, 17.6109],
                [121.7201, 17.6118],
              ],
            },
            details: {
              road_access: [[0, 2, 'yes']],
              road_class: [[0, 2, 'service']],
            },
          },
        ],
      }),
      { status: 200 }
    );

  await assert.rejects(
    resolveRoadRoute([
      [121.72, 17.61],
      [121.7201, 17.6118],
    ]),
    (error) =>
      error instanceof RoadRouteError &&
      error.code === 'ROUTING_RESTRICTED' &&
      error.status === 422
  );
});

test('GraphHopper route allows service road class by default', async () => {
  process.env.ROUTING_PROVIDER = 'graphhopper';
  process.env.GRAPHHOPPER_ROUTE_URL = 'https://routing.example.test/route';
  delete process.env.ROUTING_DISALLOWED_ROAD_CLASSES;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        paths: [
          {
            distance: 140,
            time: 60000,
            points: {
              coordinates: [
                [121.72, 17.61],
                [121.7209, 17.6109],
                [121.7201, 17.6118],
              ],
            },
            details: {
              road_access: [[0, 2, 'yes']],
              road_class: [[0, 2, 'service']],
            },
          },
        ],
      }),
      { status: 200 }
    );

  const route = await resolveRoadRoute([
    [121.72, 17.61],
    [121.7201, 17.6118],
  ]);

  assert.equal(route.provider, 'graphhopper');
  assert.equal(route.distanceKm, 0.14);
});

test('GraphHopper route allows short disallowed road class connector segments', async () => {
  process.env.ROUTING_PROVIDER = 'graphhopper';
  process.env.GRAPHHOPPER_ROUTE_URL = 'https://routing.example.test/route';
  process.env.ROUTING_DISALLOWED_ROAD_CLASSES = 'service';
  process.env.ROUTING_MAX_DISALLOWED_ROAD_CLASS_METERS = '30';
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        paths: [
          {
            distance: 20,
            time: 10000,
            points: {
              coordinates: [
                [121.72, 17.61],
                [121.72005, 17.61005],
              ],
            },
            details: {
              road_access: [[0, 1, 'yes']],
              road_class: [[0, 1, 'service']],
            },
          },
        ],
      }),
      { status: 200 }
    );

  const route = await resolveRoadRoute([
    [121.72, 17.61],
    [121.72005, 17.61005],
  ]);

  assert.equal(route.provider, 'graphhopper');
  assert.equal(route.distanceKm, 0.02);
});

test('GraphHopper provider reports a routing error when unreachable without fallback', async () => {
  process.env.ROUTING_PROVIDER = 'graphhopper';
  process.env.GRAPHHOPPER_ROUTE_URL = 'https://routing.example.test/route';
  process.env.ROUTING_ALLOW_OSRM_FALLBACK = 'false';
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed');
  };

  await assert.rejects(
    resolveRoadRoute([
      [121.72, 17.61],
      [121.73, 17.62],
    ]),
    (error) =>
      error instanceof RoadRouteError &&
      error.code === 'ROUTING_UNAVAILABLE' &&
      error.status === 502
  );
});

test('GraphHopper route returns GeoJSON coordinates and metrics', async () => {
  process.env.ROUTING_PROVIDER = 'graphhopper';
  process.env.GRAPHHOPPER_ROUTE_URL = 'https://routing.example.test/route';
  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        paths: [
          {
            distance: 2345,
            time: 240000,
            points: {
              coordinates: [
                [121.72, 17.61],
                [121.73, 17.62],
              ],
            },
            details: {
              road_access: [[0, 1, 'yes']],
            },
          },
        ],
      }),
      { status: 200 }
    );
  };

  const route = await resolveRoadRoute([
    [121.72, 17.61],
    [121.73, 17.62],
  ]);

  assert.equal(route.provider, 'graphhopper');
  assert.equal(route.distanceKm, 2.35);
  assert.equal(route.estimatedDurationMin, 4);
  assert.deepEqual(route.coordinates, [
    [121.72, 17.61],
    [121.73, 17.62],
  ]);
  assert.match(requestedUrl, /point=17\.61%2C121\.72/);
  assert.match(requestedUrl, /details=road_access/);
  assert.match(requestedUrl, /details=road_class/);
  assert.match(requestedUrl, /points_encoded=false/);
});
