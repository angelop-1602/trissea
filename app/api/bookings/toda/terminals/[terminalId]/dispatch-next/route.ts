import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import {
  bookingErrorResponse,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { dispatchNextTodaOnDemandRequest } from '@/lib/booking/service';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';

interface Params {
  params: Promise<{ terminalId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const { terminalId } = await params;
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    const limit = await checkEndpointRateLimit(request, {
      scope: 'bookings.toda.dispatch_next',
      limit: 30,
      windowMs: 60_000,
      keyParts: [actor.id],
    });
    if (!limit.allowed) {
      return rateLimitedResponse(requestId, limit.retryAfterSeconds);
    }

    const ride = await dispatchNextTodaOnDemandRequest(terminalId, actor);
    return bookingSuccess(requestId, { ride });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
