import type { RideStatus } from '@prisma/client';
import type { RideTransitionAction } from '@/lib/booking/types';

const DRIVER_TRANSITIONS: Record<RideTransitionAction, { from: RideStatus[]; to: RideStatus }> = {
  start_heading: { from: ['matched'], to: 'en_route' },
  arrive_pickup: { from: ['en_route'], to: 'arrived' },
  start_trip: { from: ['arrived'], to: 'in_trip' },
  complete_trip: { from: ['in_trip'], to: 'completed' },
  driver_cancel: { from: ['matched', 'en_route', 'arrived'], to: 'cancelled' },
  passenger_cancel: { from: ['searching', 'matched', 'en_route'], to: 'cancelled' },
};

export function resolveRideTransition(
  currentStatus: RideStatus,
  action: RideTransitionAction
): RideStatus | null {
  const transition = DRIVER_TRANSITIONS[action];
  if (!transition) {
    return null;
  }

  if (!transition.from.includes(currentStatus)) {
    return null;
  }

  return transition.to;
}
