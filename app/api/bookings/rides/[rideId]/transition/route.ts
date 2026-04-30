import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import {
  bookingError,
  bookingErrorResponse,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { rideTransitionSchema } from '@/lib/booking/schemas';
import { transitionRide } from '@/lib/booking/service';
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
    const body = await request.json().catch(() => null);
    const parsed = rideTransitionSchema.safeParse(body);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const limit = await checkEndpointRateLimit(request, {
      scope: 'bookings.rides.transition',
      limit: 30,
      windowMs: 60_000,
      keyParts: [actor.id],
    });
    if (!limit.allowed) {
      return rateLimitedResponse(requestId, limit.retryAfterSeconds);
    }

    const ride = await transitionRide(rideId, actor, parsed.data.action);
    return bookingSuccess(requestId, { ride });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
