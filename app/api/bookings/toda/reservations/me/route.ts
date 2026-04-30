import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { getPrisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    const prisma = getPrisma();

    if (actor.role !== 'passenger') {
      return bookingError(requestId, 'Only passengers can fetch personal reservations.', 403, 'FORBIDDEN_ROLE');
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        passengerId: actor.id,
      },
      include: {
        TODATerminal: true,
      },
      orderBy: [{ status: 'asc' }, { queuePosition: 'asc' }, { createdAt: 'desc' }],
    });

    return bookingSuccess(requestId, { reservations });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
