import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireActorTenantId, requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { resolveOperationalReferenceNow, startOfLocalDay } from '@/lib/demo-time';

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
    const referenceNow = await resolveOperationalReferenceNow(prisma, { tenantId });
    const todayStart = startOfLocalDay(referenceNow);

    const [terminals, drivers, todayRides, completedRides, activeRides, activeDriverPresence] = await Promise.all([
      prisma.tODATerminal.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          tenantId,
          role: 'driver',
        },
        include: {
          DriverPresence: true,
        },
      }),
      prisma.ride.findMany({
        where: {
          tenantId,
          createdAt: { gte: todayStart },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ride.findMany({
        where: {
          tenantId,
          status: 'completed',
          completedAt: { gte: todayStart },
        },
      }),
      prisma.ride.findMany({
        where: {
          tenantId,
          status: { in: ['matched', 'en_route', 'arrived', 'in_trip'] },
        },
      }),
      prisma.driverPresence.findMany({
        where: {
          tenantId,
          isOnline: true,
        },
      }),
    ]);

    const totalRevenue = completedRides.reduce((sum, ride) => sum + ride.fare * 0.1, 0);

    return bookingSuccess(requestId, {
      terminals,
      rides: todayRides,
      activeRides,
      drivers: drivers.map((driver) => ({
        id: driver.id,
        name: driver.name,
        rating: driver.rating ?? null,
        completedRides: driver.completedRides ?? 0,
        isOnline: driver.DriverPresence?.isOnline ?? false,
      })),
      stats: {
        totalTerminals: terminals.length,
        activeDrivers: activeDriverPresence.length,
        todayRides: todayRides.length,
        totalRevenue,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
