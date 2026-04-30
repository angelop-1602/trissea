import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import {
  bookingError,
  bookingErrorResponse,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { driverPresenceSchema } from '@/lib/booking/schemas';
import { upsertDriverPresence } from '@/lib/booking/service';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    const body = await request.json().catch(() => null);
    const parsed = driverPresenceSchema.safeParse(body);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const limit = await checkEndpointRateLimit(request, {
      scope: 'bookings.driver.presence',
      limit: 30,
      windowMs: 60_000,
      keyParts: [actor.id],
    });
    if (!limit.allowed) {
      return rateLimitedResponse(requestId, limit.retryAfterSeconds);
    }

    const result = await upsertDriverPresence(actor, parsed.data);
    return bookingSuccess(requestId, result);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
