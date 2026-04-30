import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import {
  bookingError,
  bookingErrorResponse,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { cancelRideByPassenger } from '@/lib/booking/service';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';

interface Params {
  params: Promise<{ rideId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const { rideId } = await params;
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    if (actor.role !== 'passenger') {
      return bookingError(requestId, 'Only passengers can cancel rides.', 403, 'FORBIDDEN_ROLE');
    }

    const limit = await checkEndpointRateLimit(request, {
      scope: 'bookings.on_demand.cancel',
      limit: 15,
      windowMs: 60_000,
      keyParts: [actor.id],
    });
    if (!limit.allowed) {
      return rateLimitedResponse(requestId, limit.retryAfterSeconds);
    }

    const ride = await cancelRideByPassenger(rideId, actor);
    return bookingSuccess(requestId, { ride });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
