import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import {
  bookingErrorResponse,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { cancelTodaReservation } from '@/lib/booking/service';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';

interface Params {
  params: Promise<{ reservationId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const { reservationId } = await params;
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    const limit = await checkEndpointRateLimit(request, {
      scope: 'bookings.toda.cancel',
      limit: 20,
      windowMs: 60_000,
      keyParts: [actor.id],
    });
    if (!limit.allowed) {
      return rateLimitedResponse(requestId, limit.retryAfterSeconds);
    }

    const reservation = await cancelTodaReservation(reservationId, actor);
    return bookingSuccess(requestId, { reservation });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
