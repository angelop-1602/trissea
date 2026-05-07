import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { p2pDepartureSchema } from '@/lib/p2p/schemas';
import { createP2PDeparture } from '@/lib/p2p/service';

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    const body = await request.json().catch(() => null);
    const parsed = p2pDepartureSchema.safeParse(body);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const departure = await createP2PDeparture(actor, {
      ...parsed.data,
      driverId: parsed.data.driverId || undefined,
      vehicleLabel: parsed.data.vehicleLabel || undefined,
    });
    return bookingSuccess(requestId, { departure }, { status: 201 });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
