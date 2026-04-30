import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { listActiveRideForPassenger } from '@/lib/booking/service';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    if (actor.role !== 'passenger') {
      return bookingError(requestId, 'Only passengers can fetch active ride.', 403, 'FORBIDDEN_ROLE');
    }

    const ride = await listActiveRideForPassenger(actor);
    const prisma = getPrisma();
    const driver =
      ride?.driverId
        ? await prisma.user.findUnique({
            where: { id: ride.driverId },
            select: {
              id: true,
              name: true,
              rating: true,
            },
          })
        : null;

    return bookingSuccess(requestId, {
      ride: ride
        ? {
            ...ride,
            driver,
          }
        : null,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
