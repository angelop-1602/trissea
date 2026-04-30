import type { RideStatus } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_TERMINAL_ANALYTICS_DAYS = 30;

export interface TerminalAnalyticsRideInput {
  createdAt: Date | string;
  status: RideStatus | string;
  completedAt: Date | string | null;
  updatedAt: Date | string;
  fare: number;
}

export interface TerminalAnalyticsReservationInput {
  createdAt: Date | string;
}

export interface TerminalAnalyticsBucket {
  date: string;
  requests: number;
  completed: number;
  cancelled: number;
  reservations: number;
  revenue: number;
}

export interface TerminalAnalyticsTotals {
  totalRequests: number;
  totalCompleted: number;
  totalCancelled: number;
  totalReservations: number;
  totalRevenue: number;
  completionRate: number;
  cancellationRate: number;
  averageFare: number;
}

export interface TerminalAnalyticsResult {
  rangeStart: Date;
  rangeEnd: Date;
  buckets: TerminalAnalyticsBucket[];
  totals: TerminalAnalyticsTotals;
}

interface AggregateTerminalAnalyticsInput {
  rides: TerminalAnalyticsRideInput[];
  reservations: TerminalAnalyticsReservationInput[];
  days?: number;
  now?: Date;
}

function startOfDayLocal(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toTerminalAnalyticsDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildTerminalAnalyticsBuckets(days = DEFAULT_TERMINAL_ANALYTICS_DAYS, now = new Date()) {
  const safeDays = Math.max(1, Math.floor(days));
  const todayStart = startOfDayLocal(now);
  const buckets: TerminalAnalyticsBucket[] = [];

  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const current = new Date(todayStart.getTime() - offset * DAY_MS);
    buckets.push({
      date: toTerminalAnalyticsDateKey(current),
      requests: 0,
      completed: 0,
      cancelled: 0,
      reservations: 0,
      revenue: 0,
    });
  }

  return buckets;
}

export function canUpdateTerminalCapacity(nextCapacity: number, currentQueued: number) {
  return nextCapacity >= currentQueued;
}

export function getTerminalCapacityValidationError(nextCapacity: number, currentQueued: number) {
  if (canUpdateTerminalCapacity(nextCapacity, currentQueued)) {
    return null;
  }

  return `Capacity cannot be lower than current queued count (${currentQueued}).`;
}

export function aggregateTerminalAnalytics({
  rides,
  reservations,
  days = DEFAULT_TERMINAL_ANALYTICS_DAYS,
  now = new Date(),
}: AggregateTerminalAnalyticsInput): TerminalAnalyticsResult {
  const buckets = buildTerminalAnalyticsBuckets(days, now);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.date, bucket]));
  const rangeStart = startOfDayLocal(new Date(now.getTime() - (Math.max(1, Math.floor(days)) - 1) * DAY_MS));
  const rangeEnd = new Date(startOfDayLocal(now).getTime() + DAY_MS - 1);

  for (const ride of rides) {
    const createdAt = toValidDate(ride.createdAt);
    if (createdAt) {
      const key = toTerminalAnalyticsDateKey(createdAt);
      const bucket = bucketMap.get(key);
      if (bucket) {
        bucket.requests += 1;
      }
    }

    if (ride.status === 'completed') {
      const completedAt = toValidDate(ride.completedAt);
      if (completedAt) {
        const key = toTerminalAnalyticsDateKey(completedAt);
        const bucket = bucketMap.get(key);
        if (bucket) {
          bucket.completed += 1;
          bucket.revenue += ride.fare;
        }
      }
    }

    if (ride.status === 'cancelled') {
      const updatedAt = toValidDate(ride.updatedAt);
      if (updatedAt) {
        const key = toTerminalAnalyticsDateKey(updatedAt);
        const bucket = bucketMap.get(key);
        if (bucket) {
          bucket.cancelled += 1;
        }
      }
    }
  }

  for (const reservation of reservations) {
    const createdAt = toValidDate(reservation.createdAt);
    if (!createdAt) continue;
    const key = toTerminalAnalyticsDateKey(createdAt);
    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.reservations += 1;
    }
  }

  const totals = buckets.reduce<TerminalAnalyticsTotals>(
    (result, bucket) => {
      result.totalRequests += bucket.requests;
      result.totalCompleted += bucket.completed;
      result.totalCancelled += bucket.cancelled;
      result.totalReservations += bucket.reservations;
      result.totalRevenue += bucket.revenue;
      return result;
    },
    {
      totalRequests: 0,
      totalCompleted: 0,
      totalCancelled: 0,
      totalReservations: 0,
      totalRevenue: 0,
      completionRate: 0,
      cancellationRate: 0,
      averageFare: 0,
    }
  );

  totals.completionRate = totals.totalRequests === 0 ? 0 : (totals.totalCompleted / totals.totalRequests) * 100;
  totals.cancellationRate = totals.totalRequests === 0 ? 0 : (totals.totalCancelled / totals.totalRequests) * 100;
  totals.averageFare = totals.totalCompleted === 0 ? 0 : totals.totalRevenue / totals.totalCompleted;

  return {
    rangeStart,
    rangeEnd,
    buckets,
    totals,
  };
}
