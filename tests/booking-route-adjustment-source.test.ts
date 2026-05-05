import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serviceSource = readFileSync('lib/booking/service.ts', 'utf8');
const typesSource = readFileSync('lib/booking/types.ts', 'utf8');
const schemaSource = readFileSync('lib/booking/schemas.ts', 'utf8');

test('booking quote results expose route adjustment metadata without changing request schema', () => {
  assert.match(typesSource, /interface OnDemandRouteAdjustments/);
  assert.match(typesSource, /pickupChanged: boolean/);
  assert.match(typesSource, /dropoffChanged: boolean/);
  assert.match(typesSource, /routeAdjustments\?: OnDemandRouteAdjustments/);
  assert.doesNotMatch(schemaSource, /routeAdjustments/);
});

test('booking quote response includes accessible road adjustments from road routing', () => {
  assert.match(serviceSource, /toOnDemandRouteAdjustments\(route\.adjustments\)/);
  assert.match(serviceSource, /routeAdjustments: route\.routeAdjustments/);
});

test('created on-demand rides store adjusted coordinates from the quote context', () => {
  assert.match(serviceSource, /pickupLatitude: quote\.pickup\.latitude/);
  assert.match(serviceSource, /pickupLongitude: quote\.pickup\.longitude/);
  assert.match(serviceSource, /dropoffLatitude: quote\.dropoff\.latitude/);
  assert.match(serviceSource, /dropoffLongitude: quote\.dropoff\.longitude/);
  assert.doesNotMatch(serviceSource, /pickupLatitude: input\.pickup\.latitude/);
  assert.doesNotMatch(serviceSource, /dropoffLatitude: input\.dropoff\.latitude/);
});
