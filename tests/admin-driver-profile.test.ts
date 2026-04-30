import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDriverTripAnalytics,
  resolveDriverProfileStatus,
  resolveTripResolutionLabel,
  resolveTripResolutionTimestamp,
  shouldShowTripDriverMarker,
} from '@/lib/dashboard/driver-profile';

test('computeDriverTripAnalytics returns expected totals and rates', () => {
  const stats = computeDriverTripAnalytics([
    { status: 'completed', fare: 120 },
    { status: 'completed', fare: 180 },
    { status: 'cancelled', fare: 90 },
    { status: 'matched', fare: 80 },
  ]);

  assert.deepEqual(stats, {
    totalTrips: 4,
    completedTrips: 2,
    cancelledTrips: 1,
    activeTrips: 1,
    totalEarnings: 300,
    averageCompletedFare: 150,
    completionRate: 50,
  });
});

test('computeDriverTripAnalytics handles empty rides', () => {
  const stats = computeDriverTripAnalytics([]);

  assert.deepEqual(stats, {
    totalTrips: 0,
    completedTrips: 0,
    cancelledTrips: 0,
    activeTrips: 0,
    totalEarnings: 0,
    averageCompletedFare: 0,
    completionRate: 0,
  });
});

test('resolveDriverProfileStatus maps pending, restricted, on-duty, and off-duty states', () => {
  assert.equal(
    resolveDriverProfileStatus({
      isDriverVerified: false,
      isDriverRestricted: false,
      isOnline: true,
    }),
    'pending'
  );

  assert.equal(
    resolveDriverProfileStatus({
      isDriverVerified: true,
      isDriverRestricted: true,
      isOnline: true,
    }),
    'restricted'
  );

  assert.equal(
    resolveDriverProfileStatus({
      isDriverVerified: true,
      isDriverRestricted: false,
      isOnline: true,
    }),
    'on-duty'
  );

  assert.equal(
    resolveDriverProfileStatus({
      isDriverVerified: true,
      isDriverRestricted: false,
      isOnline: false,
    }),
    'off-duty'
  );
});

test('shouldShowTripDriverMarker only allows active trips with coordinates', () => {
  assert.equal(
    shouldShowTripDriverMarker({
      status: 'matched',
      driverLatitude: 17.6132,
      driverLongitude: 121.7269,
    }),
    true
  );

  assert.equal(
    shouldShowTripDriverMarker({
      status: 'completed',
      driverLatitude: 17.6132,
      driverLongitude: 121.7269,
    }),
    false
  );

  assert.equal(
    shouldShowTripDriverMarker({
      status: 'matched',
      driverLatitude: null,
      driverLongitude: 121.7269,
    }),
    false
  );
});

test('resolveTripResolutionLabel maps completed and cancelled trips', () => {
  assert.equal(resolveTripResolutionLabel('completed'), 'Completed at');
  assert.equal(resolveTripResolutionLabel('cancelled'), 'Cancelled at');
  assert.equal(resolveTripResolutionLabel('matched'), null);
});

test('resolveTripResolutionTimestamp picks the correct timestamp per status', () => {
  const completedAt = new Date('2026-03-01T10:00:00.000Z');
  const updatedAt = new Date('2026-03-01T11:00:00.000Z');

  assert.equal(
    resolveTripResolutionTimestamp({
      status: 'completed',
      completedAt,
      updatedAt,
    }),
    completedAt
  );

  assert.equal(
    resolveTripResolutionTimestamp({
      status: 'cancelled',
      completedAt: null,
      updatedAt,
    }),
    updatedAt
  );

  assert.equal(
    resolveTripResolutionTimestamp({
      status: 'matched',
      completedAt: null,
      updatedAt,
    }),
    null
  );
});
