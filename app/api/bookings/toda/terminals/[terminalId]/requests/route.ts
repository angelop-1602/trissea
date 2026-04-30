import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import {
  bookingError,
  bookingErrorResponse,
  bookingSuccess,
  getRequestIdFromHeaders,
} from '@/lib/booking/http';
import { listTodaTerminalOnDemandRequests } from '@/lib/booking/service';

interface Params {
  params: Promise<{ terminalId: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const { terminalId } = await params;
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    if (actor.role !== 'driver') {
      return bookingError(requestId, 'Only drivers can view TODA terminal requests.', 403, 'FORBIDDEN_ROLE');
    }

    const rides = await listTodaTerminalOnDemandRequests(terminalId, actor);
    const normalized = rides.map(({ User_Ride_passengerIdToUser, ...ride }) => ({
      ...ride,
      passenger: User_Ride_passengerIdToUser,
    }));

    return bookingSuccess(requestId, { rides: normalized });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
