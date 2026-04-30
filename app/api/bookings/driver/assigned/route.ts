import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { listAssignedRidesForDriver } from '@/lib/booking/service';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    const rides = await listAssignedRidesForDriver(actor);
    return bookingSuccess(requestId, { rides });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
