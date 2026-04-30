import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import {
  bookingError,
  bookingErrorResponse,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { todaReservationSchema } from '@/lib/booking/schemas';
import { createTodaReservation } from '@/lib/booking/service';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    const body = await request.json().catch(() => null);
    const parsed = todaReservationSchema.safeParse(body);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const limit = await checkEndpointRateLimit(request, {
      scope: 'bookings.toda.reserve',
      limit: 20,
      windowMs: 60_000,
      keyParts: [actor.id],
    });
    if (!limit.allowed) {
      return rateLimitedResponse(requestId, limit.retryAfterSeconds);
    }

    const reservation = await createTodaReservation(
      actor,
      parsed.data.terminalId,
      parsed.data.boardingTime ? new Date(parsed.data.boardingTime) : undefined
    );

    return bookingSuccess(requestId, { reservation });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
