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

    const [rides, terminals, drivers] = await Promise.all([
      prisma.ride.findMany({
        where: { tenantId },
      }),
      prisma.tODATerminal.findMany({
        where: { tenantId },
      }),
      prisma.user.findMany({
        where: { tenantId, role: 'driver' },
        include: { DriverPresence: true },
      }),
    ]);

    const completedRides = rides.filter((ride) => ride.status === 'completed');
    const totalFares = rides.reduce((sum, ride) => sum + ride.fare, 0);
    const commission = totalFares * 0.1;
    const todayRides = rides.filter((ride) => ride.createdAt >= todayStart).length;
    const completionRate = rides.length === 0 ? 0 : (completedRides.length / rides.length) * 100;
    const onlineDrivers = drivers.filter((driver) => driver.DriverPresence?.isOnline).length;
    const terminalOccupancy =
      terminals.length === 0
        ? 0
        : terminals.reduce((sum, terminal) => sum + (terminal.capacity === 0 ? 0 : terminal.currentQueued / terminal.capacity), 0) /
          terminals.length;

    return bookingSuccess(requestId, {
      stats: {
        totalRides: rides.length,
        completedRides: completedRides.length,
        totalFares,
        commission,
        completionRate,
        driverActivity: drivers.length === 0 ? 0 : (onlineDrivers / drivers.length) * 100,
        terminalOccupancy: terminalOccupancy * 100,
        todayRides,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
