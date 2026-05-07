import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { getAdminP2POverview } from '@/lib/p2p/service';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    const overview = await getAdminP2POverview(actor);
    return bookingSuccess(requestId, overview);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
