import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireActorTenantId, requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    if (actor.role !== 'admin') {
      return bookingError(requestId, 'Only admins can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }
    const tenantId = requireActorTenantId(actor);

    const prisma = getPrisma();
    const reservations = await prisma.reservation.findMany({
      where: {
        tenantId,
      },
      include: {
        User: true,
        TODATerminal: true,
      },
      orderBy: [{ status: 'asc' }, { queuePosition: 'asc' }, { createdAt: 'desc' }],
    });

    const activeReservations = reservations.filter((reservation: (typeof reservations)[number]) =>
      ['confirmed', 'arrived', 'pending'].includes(reservation.status)
    );

    return bookingSuccess(requestId, {
      reservations,
      stats: {
        totalReservations: reservations.length,
        activeReservations: activeReservations.length,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
