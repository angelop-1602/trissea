import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { listActiveRideForDriver } from '@/lib/booking/service';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    const prisma = getPrisma();

    const ride = await listActiveRideForDriver(actor);
    const passenger =
      ride
        ? await prisma.user.findUnique({
            where: { id: ride.passengerId },
            select: {
              id: true,
              name: true,
            },
          })
        : null;
    const terminal =
      ride?.terminalId
        ? await prisma.tODATerminal.findUnique({
            where: { id: ride.terminalId },
            select: {
              id: true,
              name: true,
              location: true,
            },
          })
        : null;

    return bookingSuccess(requestId, {
      ride: ride
        ? {
            ...ride,
            passenger,
            terminal,
          }
        : null,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
