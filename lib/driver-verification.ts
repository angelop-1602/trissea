import { BookingError } from '@/lib/booking/errors';

interface DriverVerificationTransitionInput {
  currentIsDriverVerified: boolean;
  nextIsDriverVerified: boolean;
}

interface DriverRestrictionTransitionInput {
  nextIsDriverRestricted: boolean;
  hasActiveRide: boolean;
  reason?: string | null;
}

export function assertDriverVerificationTransition({
  currentIsDriverVerified,
  nextIsDriverVerified,
}: DriverVerificationTransitionInput) {
  if (currentIsDriverVerified && !nextIsDriverVerified) {
    throw new BookingError('Verified drivers cannot be moved back to pending.', 409, 'DRIVER_VERIFICATION_LOCKED');
  }
}

export function assertDriverRestrictionTransition({
  nextIsDriverRestricted,
  hasActiveRide,
  reason,
}: DriverRestrictionTransitionInput) {
  if (!nextIsDriverRestricted) {
    return;
  }

  if (!reason?.trim()) {
    throw new BookingError('Restriction reason is required.', 400, 'DRIVER_RESTRICTION_REASON_REQUIRED');
  }

  if (hasActiveRide) {
    throw new BookingError('Cannot restrict a driver with an active ride.', 409, 'DRIVER_HAS_ACTIVE_RIDE');
  }
}
