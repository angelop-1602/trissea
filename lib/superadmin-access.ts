import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { BookingError } from '@/lib/booking/errors';

export async function requireSuperadmin(request: NextRequest) {
  const user = await requireBookingProfile(request);
  const actor = toBookingActor(user);

  if (actor.role !== 'superadmin') {
    throw new BookingError('Only superadmins can access this endpoint.', 403, 'FORBIDDEN_ROLE');
  }

  return user;
}
