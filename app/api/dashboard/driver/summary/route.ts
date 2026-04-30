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
    if (actor.role !== 'driver') {
      return bookingError(requestId, 'Only drivers can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }
    const tenantId = requireActorTenantId(actor);

    const prisma = getPrisma();
    const referenceNow = await resolveOperationalReferenceNow(prisma, { tenantId, driverId: actor.id });
    const todayStart = startOfLocalDay(referenceNow);

    const [presence, activeRide, allDriverRides, todaysCompletedRides, driverProfile] = await Promise.all([
      prisma.driverPresence.findUnique({
        where: { driverId: actor.id },
      }),
      prisma.ride.findFirst({
        where: {
          tenantId,
          driverId: actor.id,
          status: {
            in: ['matched', 'en_route', 'arrived', 'in_trip'],
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ride.findMany({
        where: {
          tenantId,
          driverId: actor.id,
        },
        select: {
          id: true,
          status: true,
          fare: true,
          completedAt: true,
        },
      }),
      prisma.ride.findMany({
        where: {
          tenantId,
          driverId: actor.id,
          status: 'completed',
          completedAt: {
            gte: todayStart,
          },
        },
        select: {
          fare: true,
        },
      }),
      prisma.driverProfile.findUnique({
        where: { userId: actor.id },
        select: {
          TODATerminal: {
            select: {
              id: true,
              name: true,
              location: true,
              capacity: true,
              currentQueued: true,
            },
          },
        },
      }),
    ]);

    const completedRides = allDriverRides.filter((ride) => ride.status === 'completed');
    const cancelledRides = allDriverRides.filter((ride) => ride.status === 'cancelled');
    const assignedRides = allDriverRides.filter((ride) =>
      ['matched', 'en_route', 'arrived', 'in_trip'].includes(ride.status)
    );
    const acceptanceBase = completedRides.length + cancelledRides.length;
    const acceptanceRate =
      acceptanceBase === 0 ? 100 : Math.round((completedRides.length / acceptanceBase) * 100);

    const totalEarnings = completedRides.reduce((sum, ride) => sum + ride.fare, 0);
    const totalEarningsToday = todaysCompletedRides.reduce((sum, ride) => sum + ride.fare, 0);

    return bookingSuccess(requestId, {
      profile: {
        id: user.id,
        name: user.name,
        rating: user.rating ?? 0,
      },
      presence: {
        isOnline: presence?.isOnline ?? false,
        lastHeartbeatAt: presence?.lastHeartbeatAt ?? null,
      },
      terminalContext: driverProfile?.TODATerminal
        ? {
            id: driverProfile.TODATerminal.id,
            name: driverProfile.TODATerminal.name,
            location: driverProfile.TODATerminal.location,
            capacity: driverProfile.TODATerminal.capacity,
            currentQueued: driverProfile.TODATerminal.currentQueued,
          }
        : null,
      activeRide,
      stats: {
        assignedCount: assignedRides.length,
        ridesCompletedToday: todaysCompletedRides.length,
        ridesCompletedTotal: completedRides.length,
        totalEarnings,
        totalEarningsToday,
        acceptanceRate,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
