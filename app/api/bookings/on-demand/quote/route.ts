import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { quoteInputSchema } from '@/lib/booking/schemas';
import { quoteOnDemandRide } from '@/lib/booking/service';
import { resolveTenantByCoordinates } from '@/lib/tenant-context';

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const body = await request.json().catch(() => null);
    const parsed = quoteInputSchema.safeParse(body);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const actor = toBookingActor(user);
    if (actor.role !== 'passenger') {
      return bookingError(requestId, 'Only passengers can request quotes.', 403, 'FORBIDDEN_ROLE');
    }

    const tenant = await resolveTenantByCoordinates(parsed.data.pickup);
    const quote = await quoteOnDemandRide(parsed.data, tenant.id);
    return bookingSuccess(requestId, quote);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
