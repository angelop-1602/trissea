import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import {
  bookingError,
  bookingErrorResponse,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { rideFeedbackSchema } from '@/lib/booking/schemas';
import { submitRideFeedback } from '@/lib/booking/service';
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
    const parsed = rideFeedbackSchema.safeParse(body);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_FEEDBACK');
    }

    const limit = await checkEndpointRateLimit(request, {
      scope: 'bookings.rides.feedback',
      limit: 12,
      windowMs: 60_000,
      keyParts: [actor.id, rideId],
    });
    if (!limit.allowed) {
      return rateLimitedResponse(requestId, limit.retryAfterSeconds);
    }

    const feedback = await submitRideFeedback(rideId, actor, parsed.data);
    return bookingSuccess(
      requestId,
      {
        feedback,
      },
      { status: 201 }
    );
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
