import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { p2pDepartureTransitionSchema } from '@/lib/p2p/schemas';
import { transitionP2PDeparture } from '@/lib/p2p/service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ departureId: string }> }
) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const { departureId } = await context.params;
    const user = await requireBookingProfile(request, {
      allowPendingDriver: true,
      allowRestrictedDriver: true,
    });
    const actor = toBookingActor(user);
    const body = await request.json().catch(() => null);
    const parsed = p2pDepartureTransitionSchema.safeParse(body);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const departure = await transitionP2PDeparture(actor, departureId, parsed.data.action);
    return bookingSuccess(requestId, { departure });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
