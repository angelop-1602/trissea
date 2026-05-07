import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { cancelP2PReservationByPassenger } from '@/lib/p2p/service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reservationId: string }> }
) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const { reservationId } = await context.params;
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    const reservation = await cancelP2PReservationByPassenger(actor, reservationId);
    return bookingSuccess(requestId, { reservation });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
