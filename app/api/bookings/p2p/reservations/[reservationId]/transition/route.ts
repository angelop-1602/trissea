import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { p2pReservationTransitionSchema } from '@/lib/p2p/schemas';
import { transitionP2PReservation } from '@/lib/p2p/service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reservationId: string }> }
) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const { reservationId } = await context.params;
    const user = await requireBookingProfile(request, {
      allowPendingDriver: true,
      allowRestrictedDriver: true,
    });
    const actor = toBookingActor(user);
    const body = await request.json().catch(() => null);
    const parsed = p2pReservationTransitionSchema.safeParse(body);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const reservation = await transitionP2PReservation(actor, reservationId, parsed.data.action);
    return bookingSuccess(requestId, { reservation });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
