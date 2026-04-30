import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateTerminalAnalytics,
  canUpdateTerminalCapacity,
  toTerminalAnalyticsDateKey,
} from '@/lib/dashboard/terminal-analytics';

test('aggregateTerminalAnalytics returns 30 ordered buckets including zero-value days', () => {
  const now = new Date(2026, 2, 5, 12, 0, 0, 0);
  const result = aggregateTerminalAnalytics({
    rides: [],
    reservations: [],
    now,
    days: 30,
  });

  assert.equal(result.buckets.length, 30);
  assert.equal(result.buckets[result.buckets.length - 1]?.date, toTerminalAnalyticsDateKey(now));

  for (let index = 1; index < result.buckets.length; index += 1) {
    assert.ok(result.buckets[index].date > result.buckets[index - 1].date);
  }

  for (const bucket of result.buckets) {
    assert.equal(bucket.requests, 0);
    assert.equal(bucket.completed, 0);
    assert.equal(bucket.cancelled, 0);
    assert.equal(bucket.reservations, 0);
    assert.equal(bucket.revenue, 0);
  }
});

test('aggregateTerminalAnalytics computes requests, completed, cancelled, reservations, and derived rates', () => {
  const now = new Date(2026, 2, 5, 12, 0, 0, 0);
  const rides = [
    {
      createdAt: new Date(2026, 2, 5, 8, 0, 0, 0),
      status: 'completed',
      completedAt: new Date(2026, 2, 5, 9, 0, 0, 0),
      updatedAt: new Date(2026, 2, 5, 9, 0, 0, 0),
      fare: 100,
    },
    {
      createdAt: new Date(2026, 2, 4, 8, 0, 0, 0),
      status: 'cancelled',
      completedAt: null,
      updatedAt: new Date(2026, 2, 5, 11, 0, 0, 0),
      fare: 85,
    },
    {
      createdAt: new Date(2026, 2, 4, 10, 0, 0, 0),
      status: 'searching',
      completedAt: null,
      updatedAt: new Date(2026, 2, 4, 10, 10, 0, 0),
      fare: 65,
    },
    {
      createdAt: new Date(2026, 1, 20, 10, 0, 0, 0),
      status: 'completed',
      completedAt: new Date(2026, 1, 21, 9, 30, 0, 0),
      updatedAt: new Date(2026, 1, 21, 9, 30, 0, 0),
      fare: 120,
    },
  ] as const;

  const reservations = [
    { createdAt: new Date(2026, 2, 5, 7, 0, 0, 0) },
    { createdAt: new Date(2026, 1, 21, 7, 0, 0, 0) },
  ] as const;

  const result = aggregateTerminalAnalytics({
    rides: [...rides],
    reservations: [...reservations],
    now,
    days: 30,
  });

  assert.equal(result.totals.totalRequests, 4);
  assert.equal(result.totals.totalCompleted, 2);
  assert.equal(result.totals.totalCancelled, 1);
  assert.equal(result.totals.totalReservations, 2);
  assert.equal(result.totals.totalRevenue, 220);
  assert.equal(result.totals.completionRate, 50);
  assert.equal(result.totals.cancellationRate, 25);
  assert.equal(result.totals.averageFare, 110);

  const todayKey = toTerminalAnalyticsDateKey(now);
  const todayBucket = result.buckets.find((bucket) => bucket.date === todayKey);
  assert.ok(todayBucket);
  assert.equal(todayBucket.requests, 1);
  assert.equal(todayBucket.completed, 1);
  assert.equal(todayBucket.cancelled, 1);
  assert.equal(todayBucket.reservations, 1);
  assert.equal(todayBucket.revenue, 100);
});

test('canUpdateTerminalCapacity blocks values below current queue', () => {
  assert.equal(canUpdateTerminalCapacity(10, 10), true);
  assert.equal(canUpdateTerminalCapacity(11, 10), true);
  assert.equal(canUpdateTerminalCapacity(9, 10), false);
});
