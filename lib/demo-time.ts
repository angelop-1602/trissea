import type { PrismaClient } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

interface OperationalScope {
  tenantId?: string;
  terminalId?: string;
  driverId?: string;
  passengerId?: string;
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function getRangeStartFromNow(now: Date, days: number) {
  return new Date(startOfLocalDay(now).getTime() - (Math.max(1, Math.floor(days)) - 1) * DAY_MS);
}

export async function resolveOperationalReferenceNow(
  prisma: PrismaClient,
  scope: OperationalScope = {}
): Promise<Date> {
  const liveNow = new Date();

  if (process.env.NODE_ENV === 'production') {
    return liveNow;
  }

  const rideWhere = {
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    ...(scope.terminalId ? { terminalId: scope.terminalId } : {}),
    ...(scope.driverId ? { driverId: scope.driverId } : {}),
    ...(scope.passengerId ? { passengerId: scope.passengerId } : {}),
  };

  const reservationWhere = {
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    ...(scope.terminalId ? { terminalId: scope.terminalId } : {}),
    ...(scope.passengerId ? { passengerId: scope.passengerId } : {}),
  };

  const presenceWhere = {
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    ...(scope.driverId ? { driverId: scope.driverId } : {}),
  };

  const [
    latestRideCreated,
    latestRideCompleted,
    latestRideUpdated,
    latestReservationBoarding,
    latestReservationUpdated,
    latestPresenceHeartbeat,
  ] = await Promise.all([
    prisma.ride.findFirst({
      where: rideWhere,
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.ride.findFirst({
      where: {
        ...rideWhere,
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
    prisma.ride.findFirst({
      where: rideWhere,
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.reservation.findFirst({
      where: reservationWhere,
      orderBy: { boardingTime: 'desc' },
      select: { boardingTime: true },
    }),
    prisma.reservation.findFirst({
      where: reservationWhere,
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.driverPresence.findFirst({
      where: presenceWhere,
      orderBy: { lastHeartbeatAt: 'desc' },
      select: { lastHeartbeatAt: true },
    }),
  ]);

  const latestOperationalAt = maxDate([
    latestRideCreated?.createdAt,
    latestRideCompleted?.completedAt ?? null,
    latestRideUpdated?.updatedAt,
    latestReservationBoarding?.boardingTime,
    latestReservationUpdated?.updatedAt,
    latestPresenceHeartbeat?.lastHeartbeatAt,
  ]);

  return latestOperationalAt ?? liveNow;
}

function maxDate(values: Array<Date | null | undefined>) {
  let latest: Date | null = null;

  for (const value of values) {
    if (!value) continue;
    if (!latest || value.getTime() > latest.getTime()) {
      latest = value;
    }
  }

  return latest;
}
