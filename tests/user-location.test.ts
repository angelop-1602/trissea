import assert from 'node:assert/strict';
import test from 'node:test';
import { getLocationDistanceMeters } from '@/hooks/use-user-location';

test('getLocationDistanceMeters returns zero for the same point', () => {
  const point = { latitude: 17.6136, longitude: 121.7268 };

  assert.equal(getLocationDistanceMeters(point, point), 0);
});

test('getLocationDistanceMeters distinguishes tiny GPS jitter from real movement', () => {
  const current = { latitude: 17.6136, longitude: 121.7268 };
  const jitter = { latitude: 17.61362, longitude: 121.72682 };
  const movement = { latitude: 17.614, longitude: 121.7272 };

  assert.ok(getLocationDistanceMeters(current, jitter) < 10);
  assert.ok(getLocationDistanceMeters(current, movement) > 10);
});
