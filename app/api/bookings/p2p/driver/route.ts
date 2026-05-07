import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { getDriverP2PDashboard } from '@/lib/p2p/service';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    const dashboard = await getDriverP2PDashboard(actor);
    return bookingSuccess(requestId, dashboard);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
