import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import {
  bookingError,
  bookingErrorResponse,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';
import { p2pReservationSchema } from '@/lib/p2p/schemas';
import { createP2PReservation } from '@/lib/p2p/service';

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    if (actor.role !== 'passenger') {
      return bookingError(requestId, 'Only passengers can create P2P reservations.', 403, 'FORBIDDEN_ROLE');
    }

    const body = await request.json().catch(() => null);
    const parsed = p2pReservationSchema.safeParse(body);
    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const limit = await checkEndpointRateLimit(request, {
      scope: 'bookings.p2p.reserve',
      limit: 20,
      windowMs: 60_000,
      keyParts: [actor.id],
    });
    if (!limit.allowed) {
      return rateLimitedResponse(requestId, limit.retryAfterSeconds);
    }

    const reservation = await createP2PReservation(actor, parsed.data);
    return bookingSuccess(requestId, { reservation });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
