import { randomUUID } from 'node:crypto';
import { Prisma, type DriverPresence, type Reservation, type Ride, type RideFeedback, type UserRole } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { syncDriverProfileAfterPresenceUpdate } from '@/lib/driver-domain';
import { normalizeTenantSettings, type OnDemandFareSettings } from '@/lib/tenant-settings';
import {
  BOOKING_FARE,
  DRIVER_HEARTBEAT_MAX_AGE_SECONDS,
  DRIVER_HEARTBEAT_MIN_INTERVAL_SECONDS,
  DRIVER_STALE_CLEANUP_INTERVAL_SECONDS,
} from '@/lib/booking/constants';
import { BookingError } from '@/lib/booking/errors';
import { emitBookingEvent } from '@/lib/booking/events';
import { resolveRideTransition } from '@/lib/booking/fsm';
import {
  ACTIVE_ON_DEMAND_DRIVER_STATUSES,
  ACTIVE_ON_DEMAND_PASSENGER_STATUSES,
  type BookingActor,
  type DriverPresenceInput,
  type FareBreakdown,
  type OnDemandQuoteResult,
  type QuoteInput,
  type RideFeedbackInput,
  type RideTransitionAction,
} from '@/lib/booking/types';

interface OsrmRouteResponse {
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
}

type DriverPresenceCandidate = {
  driverId: string;
  latitude: number | null;
  longitude: number | null;
  lastHeartbeatAt: Date;
  onlineSinceAt: Date | null;
};
type TerminalGeo = {
  id: string;
  latitude: number;
  longitude: number;
};
type PrismaDbClient = Prisma.TransactionClient | ReturnType<typeof getPrisma>;
type OnDemandQuoteContext = {
  fare: FareBreakdown;
  routeCoordinates: [number, number][];
  terminalId: string;
};

const globalForPresenceCleanup = globalThis as unknown as {
  __trisseaLastPresenceCleanupAt: number | undefined;
};

async function fetchDriverPresenceById(prisma: PrismaDbClient, driverId: string): Promise<DriverPresence | null> {
  try {
    const rows = await prisma.$queryRaw<DriverPresence[]>`
      SELECT
        "driverId",
        "tenantId",
        "isOnline",
        "latitude",
        "longitude",
        "heading",
        "accuracy",
        "onlineSinceAt",
        "lastHeartbeatAt",
        "createdAt",
        "updatedAt"
      FROM "DriverPresence"
      WHERE "driverId" = ${driverId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    const rows = await prisma.$queryRaw<DriverPresence[]>`
      SELECT
        "driverId",
        "tenantId",
        "isOnline",
        "latitude",
        "longitude",
        "heading",
        "accuracy",
        NULL::timestamp AS "onlineSinceAt",
        "lastHeartbeatAt",
        "createdAt",
        "updatedAt"
      FROM "DriverPresence"
      WHERE "driverId" = ${driverId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }
}

async function listOnlineDriverCandidates(
  prisma: PrismaDbClient,
  tenantId: string,
  cutoff: Date,
  options: { requireCoordinates: boolean }
): Promise<DriverPresenceCandidate[]> {
  const coordinateFilter = options.requireCoordinates
    ? Prisma.sql`AND dp."latitude" IS NOT NULL AND dp."longitude" IS NOT NULL`
    : Prisma.empty;

  try {
    return await prisma.$queryRaw<DriverPresenceCandidate[]>`
      SELECT
        dp."driverId",
        dp."latitude",
        dp."longitude",
        dp."lastHeartbeatAt",
        dp."onlineSinceAt"
      FROM "DriverPresence" dp
      INNER JOIN "User" u ON u."id" = dp."driverId"
      WHERE dp."tenantId" = ${tenantId}
        AND dp."isOnline" = true
        AND dp."lastHeartbeatAt" >= ${cutoff}
        AND u."role" = 'driver'
        AND u."isDriverVerified" = true
        AND COALESCE(u."isDriverRestricted", false) = false
        ${coordinateFilter}
    `;
  } catch {
    return await prisma.$queryRaw<DriverPresenceCandidate[]>`
      SELECT
        dp."driverId",
        dp."latitude",
        dp."longitude",
        dp."lastHeartbeatAt",
        NULL::timestamp AS "onlineSinceAt"
      FROM "DriverPresence" dp
      INNER JOIN "User" u ON u."id" = dp."driverId"
      WHERE dp."tenantId" = ${tenantId}
        AND dp."isOnline" = true
        AND dp."lastHeartbeatAt" >= ${cutoff}
        AND u."role" = 'driver'
        AND u."isDriverVerified" = true
        AND COALESCE(u."isDriverRestricted", false) = false
        ${coordinateFilter}
    `;
  }
}

function haversineKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function findNearestTerminalId(point: { latitude: number; longitude: number }, terminals: TerminalGeo[]) {
  if (terminals.length === 0) {
    return null;
  }

  let nearestTerminal = terminals[0];
  let nearestDistance = haversineKm(point, {
    latitude: nearestTerminal.latitude,
    longitude: nearestTerminal.longitude,
  });

  for (const terminal of terminals.slice(1)) {
    const distance = haversineKm(point, {
      latitude: terminal.latitude,
      longitude: terminal.longitude,
    });
    if (distance < nearestDistance) {
      nearestTerminal = terminal;
      nearestDistance = distance;
    }
  }

  return nearestTerminal.id;
}

async function resolveTenantOnDemandFareContext(
  prisma: PrismaDbClient,
  tenantId: string,
  pickup: QuoteInput['pickup']
) {
  const [terminals, tenantSettingsRecord] = await Promise.all([
    prisma.tODATerminal.findMany({
      where: { tenantId },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    }),
    prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: {
        operationsPreferences: true,
      },
    }),
  ]);

  if (terminals.length === 0) {
    throw new BookingError('No TODA terminal is configured for this tenant.', 404, 'TERMINAL_NOT_FOUND');
  }

  const terminalId = findNearestTerminalId(pickup, terminals);
  if (!terminalId) {
    throw new BookingError('No TODA terminal is configured for this tenant.', 404, 'TERMINAL_NOT_FOUND');
  }

  const settings = normalizeTenantSettings(
    tenantSettingsRecord
      ? {
          operationsPreferences: tenantSettingsRecord.operationsPreferences,
        }
      : undefined
  );

  const onDemandFare = settings.operationsPreferences.onDemandFare;
  const terminalAdjustment =
    onDemandFare.terminalAdjustments.find((item) => item.terminalId === terminalId)?.amount ?? 0;

  return {
    terminalId,
    onDemandFare,
    terminalAdjustment,
  };
}

async function claimNextRideForTerminalDriverLine(
  tx: Prisma.TransactionClient,
  tenantId: string,
  terminalId: string
): Promise<Ride | null> {
  const nextRide = await tx.ride.findFirst({
    where: {
      tenantId,
      terminalId,
      rideType: 'on-demand',
      status: 'searching',
      driverId: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!nextRide) {
    return null;
  }

  const [terminals, activeDriverRides] = await Promise.all([
    tx.tODATerminal.findMany({
      where: { tenantId },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    }),
    tx.ride.findMany({
      where: {
        tenantId,
        driverId: { not: null },
        status: { in: ACTIVE_ON_DEMAND_DRIVER_STATUSES },
      },
      select: { driverId: true },
    }),
  ]);

  if (terminals.length === 0) {
    return null;
  }

  const cutoff = new Date(Date.now() - DRIVER_HEARTBEAT_MAX_AGE_SECONDS * 1000);
  const busyDriverIds = new Set(
    activeDriverRides.map((entry) => entry.driverId).filter((id): id is string => Boolean(id))
  );

  const candidates = await listOnlineDriverCandidates(tx, tenantId, cutoff, { requireCoordinates: false });

  const inLineDrivers = candidates
    .filter((candidate) => !busyDriverIds.has(candidate.driverId))
    .filter((candidate) => {
      if (typeof candidate.latitude === 'number' && typeof candidate.longitude === 'number') {
        const nearestTerminalId = findNearestTerminalId(
          { latitude: candidate.latitude, longitude: candidate.longitude },
          terminals
        );
        return nearestTerminalId === terminalId;
      }

      return terminals.length === 1 && terminals[0]?.id === terminalId;
    })
    .sort((a, b) => {
      const aQueueAt = (a.onlineSinceAt ?? a.lastHeartbeatAt).getTime();
      const bQueueAt = (b.onlineSinceAt ?? b.lastHeartbeatAt).getTime();

      if (aQueueAt !== bQueueAt) {
        return aQueueAt - bQueueAt;
      }

      return a.driverId.localeCompare(b.driverId);
    });

  const nextDriver = inLineDrivers[0];
  if (!nextDriver) {
    return null;
  }

  const claim = await tx.ride.updateMany({
    where: {
      id: nextRide.id,
      tenantId,
      status: 'searching',
      driverId: null,
    },
    data: {
      status: 'matched',
      driverId: nextDriver.driverId,
      driverLatitude: nextDriver.latitude ?? null,
      driverLongitude: nextDriver.longitude ?? null,
    },
  });

  if (claim.count === 0) {
    return null;
  }

  const matched = await tx.ride.findUnique({ where: { id: nextRide.id } });
  if (!matched) {
    return null;
  }

  emitBookingEvent({
    type: 'ride.updated',
    tenantId: matched.tenantId,
    entityId: matched.id,
    payload: matched,
  });

  return matched;
}

async function autoDispatchTerminalQueue(tenantId: string, terminalId: string, maxAssignments = 1): Promise<Ride[]> {
  const prisma = getPrisma();
  const assigned: Ride[] = [];
  const limit = Math.max(1, Math.min(maxAssignments, 20));

  for (let attempt = 0; attempt < limit; attempt += 1) {
    const matched = await prisma.$transaction((tx) => claimNextRideForTerminalDriverLine(tx, tenantId, terminalId));
    if (!matched) {
      break;
    }

    assigned.push(matched);
  }

  return assigned;
}

async function resolveDriverNearestTerminalId(
  tenantId: string,
  presence: Pick<DriverPresence, 'latitude' | 'longitude'>
): Promise<string | null> {
  const prisma = getPrisma();
  const terminals = await prisma.tODATerminal.findMany({
    where: { tenantId },
    select: {
      id: true,
      latitude: true,
      longitude: true,
    },
  });

  if (terminals.length === 0) {
    return null;
  }

  if (typeof presence.latitude === 'number' && typeof presence.longitude === 'number') {
    return findNearestTerminalId({ latitude: presence.latitude, longitude: presence.longitude }, terminals);
  }

  if (terminals.length === 1) {
    return terminals[0].id;
  }

  return null;
}

function ensureTenantScope(rideTenantId: string, actorTenantId: string) {
  if (rideTenantId !== actorTenantId) {
    throw new BookingError('Cross-tenant access is not allowed.', 403, 'TENANT_SCOPE_VIOLATION');
  }
}

function requireTenantScopeId(actorTenantId: string | null): string {
  if (!actorTenantId) {
    throw new BookingError('Tenant context is required for this operation.', 400, 'TENANT_REQUIRED');
  }

  return actorTenantId;
}

function ensureRole(role: UserRole, expected: UserRole) {
  if (role !== expected) {
    throw new BookingError('Forbidden for this role.', 403, 'FORBIDDEN_ROLE');
  }
}

async function fetchRoadRoute(pickup: QuoteInput['pickup'], dropoff: QuoteInput['dropoff']) {
  const coordinateString = `${pickup.longitude},${pickup.latitude};${dropoff.longitude},${dropoff.latitude}`;
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(osrmUrl, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new BookingError('Road routing service is currently unavailable.', 502, 'ROUTING_UNAVAILABLE');
  }

  const data = (await response.json()) as OsrmRouteResponse;
  const route = data.routes?.[0];

  if (!route?.geometry?.coordinates || route.geometry.coordinates.length < 2) {
    throw new BookingError('No route geometry returned by routing service.', 502, 'ROUTING_EMPTY');
  }

  return {
    routeCoordinates: route.geometry.coordinates,
    distanceKm: Number(((route.distance ?? 0) / 1000).toFixed(2)),
    estimatedDurationMin: Math.max(1, Math.ceil((route.duration ?? 0) / 60)),
  };
}

export function calculateFare(
  distanceKm: number,
  estimatedDurationMin: number,
  onDemandFare: OnDemandFareSettings = {
    baseFare: BOOKING_FARE.BASE_FARE,
    perKmFare: BOOKING_FARE.PER_KM,
    perMinuteFare: BOOKING_FARE.PER_MINUTE,
    terminalAdjustments: [],
  },
  terminalAdjustment = 0
): FareBreakdown {
  const perKmFare = Number((distanceKm * onDemandFare.perKmFare).toFixed(2));
  const perMinuteFare = Number((estimatedDurationMin * onDemandFare.perMinuteFare).toFixed(2));
  const normalizedTerminalAdjustment = Number(terminalAdjustment.toFixed(2));
  const totalFare = Number((onDemandFare.baseFare + perKmFare + perMinuteFare + normalizedTerminalAdjustment).toFixed(2));

  return {
    baseFare: onDemandFare.baseFare,
    perKmFare,
    perMinuteFare,
    terminalAdjustment: normalizedTerminalAdjustment,
    totalFare,
    distanceKm,
    estimatedDurationMin,
  };
}

async function buildOnDemandQuoteContext(
  input: QuoteInput,
  tenantId: string,
  prisma: PrismaDbClient = getPrisma()
): Promise<OnDemandQuoteContext> {
  const [route, fareContext] = await Promise.all([
    fetchRoadRoute(input.pickup, input.dropoff),
    resolveTenantOnDemandFareContext(prisma, tenantId, input.pickup),
  ]);

  return {
    fare: calculateFare(
      route.distanceKm,
      route.estimatedDurationMin,
      fareContext.onDemandFare,
      fareContext.terminalAdjustment
    ),
    routeCoordinates: route.routeCoordinates,
    terminalId: fareContext.terminalId,
  };
}

async function maybeCleanupStaleDriverPresence(prisma: ReturnType<typeof getPrisma>) {
  const now = Date.now();
  const lastCleanupAt = globalForPresenceCleanup.__trisseaLastPresenceCleanupAt ?? 0;

  if (now - lastCleanupAt < DRIVER_STALE_CLEANUP_INTERVAL_SECONDS * 1000) {
    return;
  }

  globalForPresenceCleanup.__trisseaLastPresenceCleanupAt = now;

  const cutoff = new Date(now - DRIVER_HEARTBEAT_MAX_AGE_SECONDS * 1000);

  try {
    await prisma.$executeRaw`
      UPDATE "DriverPresence"
      SET "isOnline" = false, "onlineSinceAt" = NULL, "updatedAt" = ${new Date()}
      WHERE "isOnline" = true
        AND "lastHeartbeatAt" < ${cutoff}
    `;
  } catch {
    await prisma.$executeRaw`
      UPDATE "DriverPresence"
      SET "isOnline" = false, "updatedAt" = ${new Date()}
      WHERE "isOnline" = true
        AND "lastHeartbeatAt" < ${cutoff}
    `;
  }
}

async function upsertDriverPresenceRecord(
  prisma: ReturnType<typeof getPrisma>,
  driverUser: BookingActor,
  tenantId: string,
  payload: DriverPresenceInput
): Promise<DriverPresence> {
  const current = await fetchDriverPresenceById(prisma, driverUser.id);

  if (payload.isOnline && current?.isOnline) {
    const ageMs = Date.now() - current.lastHeartbeatAt.getTime();
    if (ageMs < DRIVER_HEARTBEAT_MIN_INTERVAL_SECONDS * 1000) {
      return current;
    }
  }

  const now = new Date();
  const onlineSinceAt = payload.isOnline
    ? current?.isOnline && current.onlineSinceAt
      ? current.onlineSinceAt
      : now
    : null;

  const latitude = typeof payload.latitude === 'number' ? payload.latitude : null;
  const longitude = typeof payload.longitude === 'number' ? payload.longitude : null;
  const heading = typeof payload.heading === 'number' ? payload.heading : null;
  const accuracy = typeof payload.accuracy === 'number' ? payload.accuracy : null;

  try {
    await prisma.$executeRaw`
      INSERT INTO "DriverPresence" (
        "driverId",
        "tenantId",
        "isOnline",
        "latitude",
        "longitude",
        "heading",
        "accuracy",
        "onlineSinceAt",
        "lastHeartbeatAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${driverUser.id},
        ${tenantId},
        ${payload.isOnline},
        ${latitude},
        ${longitude},
        ${heading},
        ${accuracy},
        ${onlineSinceAt},
        ${now},
        ${now},
        ${now}
      )
      ON CONFLICT ("driverId")
      DO UPDATE SET
        "tenantId" = EXCLUDED."tenantId",
        "isOnline" = EXCLUDED."isOnline",
        "latitude" = EXCLUDED."latitude",
        "longitude" = EXCLUDED."longitude",
        "heading" = EXCLUDED."heading",
        "accuracy" = EXCLUDED."accuracy",
        "onlineSinceAt" = EXCLUDED."onlineSinceAt",
        "lastHeartbeatAt" = EXCLUDED."lastHeartbeatAt",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  } catch {
    await prisma.$executeRaw`
      INSERT INTO "DriverPresence" (
        "driverId",
        "tenantId",
        "isOnline",
        "latitude",
        "longitude",
        "heading",
        "accuracy",
        "lastHeartbeatAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${driverUser.id},
        ${tenantId},
        ${payload.isOnline},
        ${latitude},
        ${longitude},
        ${heading},
        ${accuracy},
        ${now},
        ${now},
        ${now}
      )
      ON CONFLICT ("driverId")
      DO UPDATE SET
        "tenantId" = EXCLUDED."tenantId",
        "isOnline" = EXCLUDED."isOnline",
        "latitude" = EXCLUDED."latitude",
        "longitude" = EXCLUDED."longitude",
        "heading" = EXCLUDED."heading",
        "accuracy" = EXCLUDED."accuracy",
        "lastHeartbeatAt" = EXCLUDED."lastHeartbeatAt",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  }

  const presence = await fetchDriverPresenceById(prisma, driverUser.id);
  if (!presence) {
    throw new BookingError('Failed to persist driver presence.', 500, 'PRESENCE_UPSERT_FAILED');
  }

  return presence;
}

async function findRideOrThrow(prisma: Prisma.TransactionClient | ReturnType<typeof getPrisma>, rideId: string) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) {
    throw new BookingError('Ride not found.', 404, 'RIDE_NOT_FOUND');
  }
  return ride;
}

function normalizeFeedbackNote(note?: string) {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}

async function syncUserRatingAggregate(tx: Prisma.TransactionClient, userId: string) {
  const aggregate = await tx.rideFeedback.aggregate({
    where: { subjectUserId: userId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const count = aggregate._count.rating ?? 0;
  const average = aggregate._avg.rating;

  await tx.user.update({
    where: { id: userId },
    data: {
      rating: count > 0 && typeof average === 'number' ? Number(average.toFixed(1)) : null,
    },
  });
}

export async function quoteOnDemandRide(input: QuoteInput, _tenantId: string): Promise<OnDemandQuoteResult> {
  const route = await buildOnDemandQuoteContext(input, _tenantId);
  return {
    fare: route.fare,
    routeCoordinates: route.routeCoordinates,
  };
}

export async function assignNearestDriver(rideId: string): Promise<Ride> {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const ride = await findRideOrThrow(tx, rideId);

    if (ride.status !== 'searching' || ride.driverId) {
      return ride;
    }

    const cutoff = new Date(Date.now() - DRIVER_HEARTBEAT_MAX_AGE_SECONDS * 1000);

    const activeDriverRides = await tx.ride.findMany({
      where: {
        tenantId: ride.tenantId,
        driverId: { not: null },
        status: { in: ACTIVE_ON_DEMAND_DRIVER_STATUSES },
      },
      select: { driverId: true },
    });

    const busyDriverIds = new Set(
      activeDriverRides.map((entry) => entry.driverId).filter((id): id is string => Boolean(id))
    );

    const candidates = await listOnlineDriverCandidates(tx, ride.tenantId, cutoff, {
      requireCoordinates: true,
    });

    const available = candidates.filter((candidate) => !busyDriverIds.has(candidate.driverId));

    if (available.length === 0) {
      return ride;
    }

    let nearest = available[0];
    let nearestDistance = haversineKm(
      { latitude: ride.pickupLatitude, longitude: ride.pickupLongitude },
      { latitude: nearest.latitude ?? ride.pickupLatitude, longitude: nearest.longitude ?? ride.pickupLongitude }
    );

    for (const candidate of available.slice(1)) {
      const distance = haversineKm(
        { latitude: ride.pickupLatitude, longitude: ride.pickupLongitude },
        {
          latitude: candidate.latitude ?? ride.pickupLatitude,
          longitude: candidate.longitude ?? ride.pickupLongitude,
        }
      );
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }

    const matched = await tx.ride.update({
      where: { id: ride.id },
      data: {
        driverId: nearest.driverId,
        status: 'matched',
        driverLatitude: nearest.latitude,
        driverLongitude: nearest.longitude,
      },
    });

    emitBookingEvent({
      type: 'ride.updated',
      tenantId: matched.tenantId,
      entityId: matched.id,
      payload: matched,
    });

    return matched;
  });
}

export async function createOnDemandRide(input: QuoteInput, passengerUser: BookingActor): Promise<Ride> {
  ensureRole(passengerUser.role, 'passenger');
  const tenantId = requireTenantScopeId(passengerUser.tenantId);

  const prisma = getPrisma();
  const activeRide = await prisma.ride.findFirst({
    where: {
      tenantId,
      passengerId: passengerUser.id,
      rideType: 'on-demand',
      status: {
        in: ACTIVE_ON_DEMAND_PASSENGER_STATUSES,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (activeRide) {
    return activeRide;
  }

  const quote = await buildOnDemandQuoteContext(input, tenantId, prisma);

  const ride = await prisma.ride.create({
    data: {
      id: randomUUID(),
      tenantId,
      passengerId: passengerUser.id,
      terminalId: quote.terminalId,
      pickupLocation: input.pickupLabel ?? 'Pinned pickup',
      dropoffLocation: input.dropoffLabel ?? 'Pinned dropoff',
      pickupLatitude: input.pickup.latitude,
      pickupLongitude: input.pickup.longitude,
      dropoffLatitude: input.dropoff.latitude,
      dropoffLongitude: input.dropoff.longitude,
      status: 'searching',
      fare: quote.fare.totalFare,
      distance: quote.fare.distanceKm,
      estimatedDuration: quote.fare.estimatedDurationMin,
      rideType: 'on-demand',
    },
  });

  emitBookingEvent({
    type: 'ride.updated',
    tenantId: ride.tenantId,
    entityId: ride.id,
    payload: ride,
  });

  await autoDispatchTerminalQueue(tenantId, quote.terminalId, 10);
  return (await prisma.ride.findUnique({ where: { id: ride.id } })) ?? ride;
}

export async function upsertDriverPresence(
  driverUser: BookingActor,
  payload: DriverPresenceInput
): Promise<{ presence: DriverPresence; newlyAssignedRideId?: string }> {
  ensureRole(driverUser.role, 'driver');
  const tenantId = requireTenantScopeId(driverUser.tenantId);

  const prisma = getPrisma();
  await maybeCleanupStaleDriverPresence(prisma);

  const existingActiveRide = await prisma.ride.findFirst({
    where: {
      tenantId,
      driverId: driverUser.id,
      status: { in: ACTIVE_ON_DEMAND_DRIVER_STATUSES },
    },
    select: { id: true },
  });

  const presence = await upsertDriverPresenceRecord(prisma, driverUser, tenantId, payload);
  await syncDriverProfileAfterPresenceUpdate(prisma, {
    driverId: driverUser.id,
    isOnline: payload.isOnline,
  });

  emitBookingEvent({
    type: 'presence.updated',
    tenantId: presence.tenantId,
    entityId: presence.driverId,
    payload: presence,
  });

  if (!payload.isOnline) {
    return { presence };
  }

  if (existingActiveRide) {
    return { presence };
  }

  const terminalId = await resolveDriverNearestTerminalId(tenantId, presence);
  if (!terminalId) {
    return { presence };
  }

  await autoDispatchTerminalQueue(tenantId, terminalId, 1);

  const assignedRide = await prisma.ride.findFirst({
    where: {
      tenantId,
      driverId: driverUser.id,
      status: { in: ACTIVE_ON_DEMAND_DRIVER_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  return { presence, newlyAssignedRideId: assignedRide?.id };
}

export async function listTodaTerminalOnDemandRequests(terminalId: string, actor: BookingActor) {
  ensureRole(actor.role, 'driver');
  const tenantId = requireTenantScopeId(actor.tenantId);

  const prisma = getPrisma();
  const terminal = await prisma.tODATerminal.findUnique({
    where: { id: terminalId },
    select: {
      id: true,
      tenantId: true,
    },
  });

  if (!terminal) {
    throw new BookingError('Terminal not found.', 404, 'TERMINAL_NOT_FOUND');
  }

  ensureTenantScope(terminal.tenantId, tenantId);

  return prisma.ride.findMany({
    where: {
      tenantId,
      terminalId,
      rideType: 'on-demand',
      status: {
        in: ['searching', 'matched', 'en_route', 'arrived', 'in_trip'],
      },
    },
    include: {
      User_Ride_passengerIdToUser: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function dispatchNextTodaOnDemandRequest(
  terminalId: string,
  driverUser: BookingActor
): Promise<Ride | null> {
  ensureRole(driverUser.role, 'driver');
  const tenantId = requireTenantScopeId(driverUser.tenantId);

  const prisma = getPrisma();
  const terminal = await prisma.tODATerminal.findUnique({
    where: { id: terminalId },
    select: {
      id: true,
      tenantId: true,
    },
  });

  if (!terminal) {
    throw new BookingError('Terminal not found.', 404, 'TERMINAL_NOT_FOUND');
  }

  ensureTenantScope(terminal.tenantId, tenantId);

  const [matched] = await autoDispatchTerminalQueue(tenantId, terminalId, 1);
  return matched ?? null;
}

export async function transitionRide(
  rideId: string,
  actorUser: BookingActor,
  action: RideTransitionAction
): Promise<Ride> {
  ensureRole(actorUser.role, 'driver');
  const tenantId = requireTenantScopeId(actorUser.tenantId);

  const prisma = getPrisma();
  const ride = await findRideOrThrow(prisma, rideId);

  ensureTenantScope(ride.tenantId, tenantId);

  if (ride.driverId !== actorUser.id) {
    throw new BookingError('Only the assigned driver can change ride status.', 403, 'NOT_ASSIGNED_DRIVER');
  }

  if (action === 'passenger_cancel') {
    throw new BookingError('Unsupported transition action.', 400, 'INVALID_ACTION');
  }

  const nextStatus = resolveRideTransition(ride.status, action);
  if (!nextStatus) {
    throw new BookingError('Invalid transition for the current ride status.', 409, 'INVALID_TRANSITION');
  }

  const data: Prisma.RideUpdateInput = {};

  switch (action) {
    case 'start_trip':
      data.startedAt = ride.startedAt ?? new Date();
      break;
    case 'complete_trip':
      data.completedAt = new Date();
      if (ride.startedAt) {
        const diffMinutes = Math.max(1, Math.ceil((Date.now() - ride.startedAt.getTime()) / 60000));
        data.actualDuration = diffMinutes;
      }
      break;
    default:
      break;
  }

  const updated = await prisma.ride.update({
    where: { id: ride.id },
    data: {
      status: nextStatus,
      ...data,
    },
  });

  emitBookingEvent({
    type: 'ride.updated',
    tenantId: updated.tenantId,
    entityId: updated.id,
    payload: updated,
  });

  if ((updated.status === 'completed' || updated.status === 'cancelled') && updated.terminalId) {
    await autoDispatchTerminalQueue(updated.tenantId, updated.terminalId, 1);
  }

  return updated;
}

export async function cancelRideByPassenger(rideId: string, passengerUser: BookingActor): Promise<Ride> {
  ensureRole(passengerUser.role, 'passenger');

  const prisma = getPrisma();
  const ride = await findRideOrThrow(prisma, rideId);

  if (ride.passengerId !== passengerUser.id) {
    throw new BookingError('Only the ride passenger can cancel this ride.', 403, 'NOT_RIDE_PASSENGER');
  }

  if (ride.status === 'cancelled') {
    return ride;
  }

  if (!resolveRideTransition(ride.status, 'passenger_cancel')) {
    throw new BookingError('Passenger can cancel only before trip starts.', 409, 'INVALID_TRANSITION');
  }

  const cancelled = await prisma.ride.update({
    where: { id: ride.id },
    data: { status: 'cancelled' },
  });

  emitBookingEvent({
    type: 'ride.updated',
    tenantId: cancelled.tenantId,
    entityId: cancelled.id,
    payload: cancelled,
  });

  if (cancelled.driverId && cancelled.terminalId) {
    await autoDispatchTerminalQueue(cancelled.tenantId, cancelled.terminalId, 1);
  }

  return cancelled;
}

export async function submitRideFeedback(
  rideId: string,
  actorUser: BookingActor,
  input: RideFeedbackInput
): Promise<RideFeedback> {
  if (actorUser.role !== 'passenger' && actorUser.role !== 'driver') {
    throw new BookingError('Only passengers and drivers can submit ride feedback.', 403, 'FORBIDDEN_ROLE');
  }

  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const ride = await findRideOrThrow(tx, rideId);

    if (ride.status !== 'completed') {
      throw new BookingError('Feedback can only be submitted after a completed trip.', 409, 'FEEDBACK_NOT_ALLOWED');
    }

    let subjectUserId: string | null = null;

    if (actorUser.role === 'passenger') {
      if (ride.passengerId !== actorUser.id) {
        throw new BookingError('Only the ride passenger can rate the driver.', 403, 'NOT_RIDE_PASSENGER');
      }
      subjectUserId = ride.driverId;
    } else {
      const tenantId = requireTenantScopeId(actorUser.tenantId);
      ensureTenantScope(ride.tenantId, tenantId);

      if (ride.driverId !== actorUser.id) {
        throw new BookingError('Only the assigned driver can rate the passenger.', 403, 'NOT_ASSIGNED_DRIVER');
      }
      subjectUserId = ride.passengerId;
    }

    if (!subjectUserId) {
      throw new BookingError('This completed trip cannot be rated yet.', 409, 'FEEDBACK_NOT_ALLOWED');
    }

    const feedback = await tx.rideFeedback.upsert({
      where: {
        rideId_reviewerUserId: {
          rideId: ride.id,
          reviewerUserId: actorUser.id,
        },
      },
      create: {
        id: randomUUID(),
        rideId: ride.id,
        reviewerUserId: actorUser.id,
        subjectUserId,
        rating: input.rating,
        note: normalizeFeedbackNote(input.note),
      },
      update: {
        subjectUserId,
        rating: input.rating,
        note: normalizeFeedbackNote(input.note),
      },
    });

    await syncUserRatingAggregate(tx, subjectUserId);
    return feedback;
  });
}

export async function listActiveRideForPassenger(passengerUser: BookingActor): Promise<Ride | null> {
  ensureRole(passengerUser.role, 'passenger');

  const prisma = getPrisma();
  return prisma.ride.findFirst({
    where: {
      passengerId: passengerUser.id,
      rideType: 'on-demand',
      status: { in: ACTIVE_ON_DEMAND_PASSENGER_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listActiveRideForDriver(driverUser: BookingActor): Promise<Ride | null> {
  ensureRole(driverUser.role, 'driver');
  const tenantId = requireTenantScopeId(driverUser.tenantId);

  const prisma = getPrisma();
  return prisma.ride.findFirst({
    where: {
      tenantId,
      driverId: driverUser.id,
      rideType: 'on-demand',
      status: { in: ACTIVE_ON_DEMAND_DRIVER_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listAssignedRidesForDriver(driverUser: BookingActor): Promise<Ride[]> {
  ensureRole(driverUser.role, 'driver');
  const tenantId = requireTenantScopeId(driverUser.tenantId);

  const prisma = getPrisma();
  return prisma.ride.findMany({
    where: {
      tenantId,
      driverId: driverUser.id,
      rideType: 'on-demand',
      status: { in: ACTIVE_ON_DEMAND_DRIVER_STATUSES },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createTodaReservation(
  passengerUser: BookingActor,
  terminalId: string,
  boardingTime?: Date
): Promise<Reservation> {
  ensureRole(passengerUser.role, 'passenger');

  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const terminal = await tx.tODATerminal.findUnique({ where: { id: terminalId } });
    if (!terminal) {
      throw new BookingError('Terminal not found.', 404, 'TERMINAL_NOT_FOUND');
    }

    const existingReservation = await tx.reservation.findFirst({
      where: {
        tenantId: terminal.tenantId,
        terminalId,
        passengerId: passengerUser.id,
        status: {
          in: ['confirmed', 'arrived'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingReservation) {
      return existingReservation;
    }

    const highestQueue = await tx.reservation.findFirst({
      where: {
        terminalId,
        status: { in: ['confirmed', 'arrived'] },
      },
      orderBy: { queuePosition: 'desc' },
      select: { queuePosition: true },
    });

    const queuePosition = (highestQueue?.queuePosition ?? 0) + 1;

    const reservation = await tx.reservation.create({
      data: {
        id: randomUUID(),
        tenantId: terminal.tenantId,
        passengerId: passengerUser.id,
        terminalId,
        boardingTime: boardingTime ?? new Date(),
        status: 'confirmed',
        queuePosition,
      },
    });

    const terminalUpdated = await tx.tODATerminal.update({
      where: { id: terminalId },
      data: { currentQueued: terminal.currentQueued + 1 },
    });

    emitBookingEvent({
      type: 'reservation.updated',
      tenantId: reservation.tenantId,
      entityId: reservation.id,
      payload: reservation,
    });

    emitBookingEvent({
      type: 'terminal.updated',
      tenantId: terminalUpdated.tenantId,
      entityId: terminalUpdated.id,
      payload: terminalUpdated,
    });

    return reservation;
  });
}

export async function cancelTodaReservation(
  reservationId: string,
  passengerUser: BookingActor
): Promise<Reservation> {
  ensureRole(passengerUser.role, 'passenger');

  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) {
      throw new BookingError('Reservation not found.', 404, 'RESERVATION_NOT_FOUND');
    }

    if (reservation.passengerId !== passengerUser.id) {
      throw new BookingError('Only the reservation owner can cancel.', 403, 'NOT_RESERVATION_OWNER');
    }

    if (reservation.status !== 'confirmed') {
      throw new BookingError('Only confirmed reservations can be cancelled.', 409, 'INVALID_RESERVATION_STATUS');
    }

    const cancelled = await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: 'cancelled' },
    });

    await tx.reservation.updateMany({
      where: {
        terminalId: reservation.terminalId,
        status: 'confirmed',
        queuePosition: { gt: reservation.queuePosition },
      },
      data: {
        queuePosition: { decrement: 1 },
      },
    });

    const terminal = await tx.tODATerminal.findUnique({ where: { id: reservation.terminalId } });
    if (!terminal) {
      throw new BookingError('Terminal not found.', 404, 'TERMINAL_NOT_FOUND');
    }

    const terminalUpdated = await tx.tODATerminal.update({
      where: { id: reservation.terminalId },
      data: {
        currentQueued: Math.max(0, terminal.currentQueued - 1),
      },
    });

    emitBookingEvent({
      type: 'reservation.updated',
      tenantId: cancelled.tenantId,
      entityId: cancelled.id,
      payload: cancelled,
    });

    emitBookingEvent({
      type: 'terminal.updated',
      tenantId: terminalUpdated.tenantId,
      entityId: terminalUpdated.id,
      payload: terminalUpdated,
    });

    return cancelled;
  });
}

export async function dispatchNextTodaPassenger(
  terminalId: string,
  driverUser: BookingActor
): Promise<Reservation | null> {
  ensureRole(driverUser.role, 'driver');
  const tenantId = requireTenantScopeId(driverUser.tenantId);

  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const terminal = await tx.tODATerminal.findUnique({ where: { id: terminalId } });
    if (!terminal) {
      throw new BookingError('Terminal not found.', 404, 'TERMINAL_NOT_FOUND');
    }

    ensureTenantScope(terminal.tenantId, tenantId);

    const nextReservation = await tx.reservation.findFirst({
      where: {
        terminalId,
        status: 'confirmed',
      },
      orderBy: { queuePosition: 'asc' },
    });

    if (!nextReservation) {
      return null;
    }

    const dispatched = await tx.reservation.update({
      where: { id: nextReservation.id },
      data: { status: 'arrived' },
    });

    emitBookingEvent({
      type: 'reservation.updated',
      tenantId: dispatched.tenantId,
      entityId: dispatched.id,
      payload: dispatched,
    });

    return dispatched;
  });
}

export async function completeTodaReservation(
  reservationId: string,
  driverUser: BookingActor
): Promise<Reservation> {
  ensureRole(driverUser.role, 'driver');
  const tenantId = requireTenantScopeId(driverUser.tenantId);

  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) {
      throw new BookingError('Reservation not found.', 404, 'RESERVATION_NOT_FOUND');
    }

    ensureTenantScope(reservation.tenantId, tenantId);

    if (reservation.status !== 'arrived') {
      throw new BookingError('Only arrived reservations can be completed.', 409, 'INVALID_RESERVATION_STATUS');
    }

    const completed = await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: 'completed' },
    });

    await tx.reservation.updateMany({
      where: {
        terminalId: reservation.terminalId,
        status: 'confirmed',
        queuePosition: { gt: reservation.queuePosition },
      },
      data: {
        queuePosition: { decrement: 1 },
      },
    });

    const terminal = await tx.tODATerminal.findUnique({ where: { id: reservation.terminalId } });
    if (!terminal) {
      throw new BookingError('Terminal not found.', 404, 'TERMINAL_NOT_FOUND');
    }

    const terminalUpdated = await tx.tODATerminal.update({
      where: { id: reservation.terminalId },
      data: {
        currentQueued: Math.max(0, terminal.currentQueued - 1),
      },
    });

    emitBookingEvent({
      type: 'reservation.updated',
      tenantId: completed.tenantId,
      entityId: completed.id,
      payload: completed,
    });

    emitBookingEvent({
      type: 'terminal.updated',
      tenantId: terminalUpdated.tenantId,
      entityId: terminalUpdated.id,
      payload: terminalUpdated,
    });

    return completed;
  });
}

