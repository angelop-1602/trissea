import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRideTransition } from '@/lib/booking/fsm';

test('driver transition lifecycle is valid', () => {
  assert.equal(resolveRideTransition('matched', 'start_heading'), 'en_route');
  assert.equal(resolveRideTransition('en_route', 'arrive_pickup'), 'arrived');
  assert.equal(resolveRideTransition('arrived', 'start_trip'), 'in_trip');
  assert.equal(resolveRideTransition('in_trip', 'complete_trip'), 'completed');
});

test('driver cancel allowed only before trip starts', () => {
  assert.equal(resolveRideTransition('matched', 'driver_cancel'), 'cancelled');
  assert.equal(resolveRideTransition('arrived', 'driver_cancel'), 'cancelled');
  assert.equal(resolveRideTransition('in_trip', 'driver_cancel'), null);
});

test('passenger cancel allowed only pre-start', () => {
  assert.equal(resolveRideTransition('searching', 'passenger_cancel'), 'cancelled');
  assert.equal(resolveRideTransition('en_route', 'passenger_cancel'), 'cancelled');
  assert.equal(resolveRideTransition('arrived', 'passenger_cancel'), null);
});
