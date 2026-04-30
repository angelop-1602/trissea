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
    const users = await prisma.user.findMany({
      where: {
        tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });

    const roleCounts = users.reduce(
      (acc, item) => {
        acc[item.role] += 1;
        return acc;
      },
      {
        passenger: 0,
        driver: 0,
        admin: 0,
        superadmin: 0,
      }
    );

    return bookingSuccess(requestId, {
      users,
      stats: {
        totalUsers: users.length,
        roleCounts,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
