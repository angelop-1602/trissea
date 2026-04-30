import { ACTIVE_ON_DEMAND_DRIVER_STATUSES } from '@/lib/booking/types';

const ACTIVE_DRIVER_STATUS_SET = new Set<string>(ACTIVE_ON_DEMAND_DRIVER_STATUSES);

export interface DriverTripAnalyticsInput {
  status: string;
  fare: number;
}

export interface DriverTripAnalyticsResult {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  activeTrips: number;
  totalEarnings: number;
  averageCompletedFare: number;
  completionRate: number;
}

function toOneDecimal(value: number): number {
  return Number(value.toFixed(1));
}

function toTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}

export function computeDriverTripAnalytics(rides: DriverTripAnalyticsInput[]): DriverTripAnalyticsResult {
  const totalTrips = rides.length;
  const completedTrips = rides.filter((ride) => ride.status === 'completed');
  const cancelledTrips = rides.filter((ride) => ride.status === 'cancelled').length;
  const activeTrips = rides.filter((ride) => ACTIVE_DRIVER_STATUS_SET.has(ride.status)).length;
  const totalEarnings = completedTrips.reduce((sum, ride) => sum + ride.fare, 0);
  const averageCompletedFare = completedTrips.length === 0 ? 0 : toTwoDecimals(totalEarnings / completedTrips.length);
  const completionRate = totalTrips === 0 ? 0 : toOneDecimal((completedTrips.length / totalTrips) * 100);

  return {
    totalTrips,
    completedTrips: completedTrips.length,
    cancelledTrips,
    activeTrips,
    totalEarnings,
    averageCompletedFare,
    completionRate,
  };
}

export function resolveDriverProfileStatus(input: {
  isDriverVerified: boolean;
  isDriverRestricted?: boolean;
  isOnline: boolean;
}): 'pending' | 'restricted' | 'on-duty' | 'off-duty' {
  if (!input.isDriverVerified) {
    return 'pending';
  }

  if (input.isDriverRestricted) {
    return 'restricted';
  }

  if (input.isOnline) {
    return 'on-duty';
  }

  return 'off-duty';
}

export function isActiveDriverTripStatus(status: string): boolean {
  return ACTIVE_DRIVER_STATUS_SET.has(status);
}

export function shouldShowTripDriverMarker(input: {
  status: string;
  driverLatitude: number | null;
  driverLongitude: number | null;
}): boolean {
  return (
    isActiveDriverTripStatus(input.status) &&
    typeof input.driverLatitude === 'number' &&
    Number.isFinite(input.driverLatitude) &&
    typeof input.driverLongitude === 'number' &&
    Number.isFinite(input.driverLongitude)
  );
}

export function resolveTripResolutionLabel(status: string): 'Completed at' | 'Cancelled at' | null {
  if (status === 'completed') {
    return 'Completed at';
  }

  if (status === 'cancelled') {
    return 'Cancelled at';
  }

  return null;
}

export function resolveTripResolutionTimestamp(input: {
  status: string;
  completedAt: Date | string | null;
  updatedAt: Date | string;
}): Date | string | null {
  if (input.status === 'completed') {
    return input.completedAt ?? input.updatedAt;
  }

  if (input.status === 'cancelled') {
    return input.updatedAt;
  }

  return null;
}
