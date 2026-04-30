import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ACTIVE_ON_DEMAND_PASSENGER_STATUSES } from '@/lib/booking/types';
import { requireActorTenantId, requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { AUDIT_MODULES, createTenantAuditLog } from '@/lib/audit-log';
import { getPrisma } from '@/lib/prisma';
import {
  aggregateTerminalAnalytics,
  DEFAULT_TERMINAL_ANALYTICS_DAYS,
  getTerminalCapacityValidationError,
} from '@/lib/dashboard/terminal-analytics';
import { getRangeStartFromNow, resolveOperationalReferenceNow } from '@/lib/demo-time';

interface Params {
  params: Promise<{ terminalId: string }>;
}

const updateTerminalSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  location: z.string().trim().min(2).max(200).optional(),
  capacity: z.number().int().min(1).max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const { terminalId } = await params;
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    if (actor.role !== 'admin') {
      return bookingError(requestId, 'Only admins can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }
    const tenantId = requireActorTenantId(actor);
    const prisma = getPrisma();

    const terminal = await prisma.tODATerminal.findFirst({
      where: {
        id: terminalId,
        tenantId,
      },
    });

    if (!terminal) {
      return bookingError(requestId, 'Terminal not found.', 404, 'TERMINAL_NOT_FOUND');
    }

    const now = await resolveOperationalReferenceNow(prisma, { tenantId, terminalId });
    const rangeStart = getRangeStartFromNow(now, DEFAULT_TERMINAL_ANALYTICS_DAYS);

    const [activeRides, activeReservations, analyticsRides, analyticsReservations] = await Promise.all([
      prisma.ride.findMany({
        where: {
          tenantId,
          terminalId,
          rideType: 'on-demand',
          status: { in: ACTIVE_ON_DEMAND_PASSENGER_STATUSES },
        },
        include: {
          User_Ride_passengerIdToUser: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          User_Ride_driverIdToUser: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.reservation.findMany({
        where: {
          tenantId,
          terminalId,
          status: {
            in: ['pending', 'confirmed', 'arrived'],
          },
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: [{ queuePosition: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.ride.findMany({
        where: {
          tenantId,
          terminalId,
          rideType: 'on-demand',
          OR: [
            { createdAt: { gte: rangeStart } },
            {
              status: 'completed',
              completedAt: { gte: rangeStart },
            },
            {
              status: 'cancelled',
              updatedAt: { gte: rangeStart },
            },
          ],
        },
        select: {
          createdAt: true,
          status: true,
          completedAt: true,
          updatedAt: true,
          fare: true,
        },
      }),
      prisma.reservation.findMany({
        where: {
          tenantId,
          terminalId,
          createdAt: { gte: rangeStart },
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    const analyticsResult = aggregateTerminalAnalytics({
      rides: analyticsRides,
      reservations: analyticsReservations,
      days: DEFAULT_TERMINAL_ANALYTICS_DAYS,
      now,
    });

    const todayAnalytics = analyticsResult.buckets[analyticsResult.buckets.length - 1] ?? {
      requests: 0,
      completed: 0,
      cancelled: 0,
      reservations: 0,
      revenue: 0,
    };

    const activeOnDemandQueued = activeRides.filter((ride) => ride.status === 'searching').length;
    const activeOnDemandInProgress = activeRides.filter((ride) =>
      ['matched', 'en_route', 'arrived', 'in_trip'].includes(ride.status)
    ).length;
    const occupancyPercent = terminal.capacity === 0 ? 0 : (terminal.currentQueued / terminal.capacity) * 100;

    return bookingSuccess(requestId, {
      terminal,
      stats: {
        currentQueued: terminal.currentQueued,
        capacity: terminal.capacity,
        occupancyPercent,
        activeOnDemandQueued,
        activeOnDemandInProgress,
        activeOnDemandTotal: activeRides.length,
        activeReservationsTotal: activeReservations.length,
        today: {
          requests: todayAnalytics.requests,
          completed: todayAnalytics.completed,
          cancelled: todayAnalytics.cancelled,
          reservations: todayAnalytics.reservations,
          revenue: todayAnalytics.revenue,
        },
        totals30d: {
          requests: analyticsResult.totals.totalRequests,
          completed: analyticsResult.totals.totalCompleted,
          cancelled: analyticsResult.totals.totalCancelled,
          reservations: analyticsResult.totals.totalReservations,
          revenue: analyticsResult.totals.totalRevenue,
          completionRate: analyticsResult.totals.completionRate,
          cancellationRate: analyticsResult.totals.cancellationRate,
          averageFare: analyticsResult.totals.averageFare,
        },
      },
      activeRides: activeRides.map(({ User_Ride_passengerIdToUser, User_Ride_driverIdToUser, ...ride }) => ({
        ...ride,
        passenger: User_Ride_passengerIdToUser,
        driver: User_Ride_driverIdToUser,
      })),
      activeReservations: activeReservations.map(({ User, ...reservation }) => ({
        ...reservation,
        passenger: User,
      })),
      analytics: analyticsResult.buckets,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const { terminalId } = await params;
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    if (actor.role !== 'admin') {
      return bookingError(requestId, 'Only admins can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }
    const tenantId = requireActorTenantId(actor);

    const body = await request.json().catch(() => null);
    const parsed = updateTerminalSchema.safeParse(body);
    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    if (
      parsed.data.name === undefined &&
      parsed.data.location === undefined &&
      parsed.data.capacity === undefined &&
      parsed.data.latitude === undefined &&
      parsed.data.longitude === undefined
    ) {
      return bookingError(requestId, 'At least one field is required for update.', 400, 'INVALID_REQUEST');
    }

    const hasLatitude = parsed.data.latitude !== undefined;
    const hasLongitude = parsed.data.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      return bookingError(requestId, 'Latitude and longitude must be provided together.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    const terminal = await prisma.tODATerminal.findFirst({
      where: {
        id: terminalId,
        tenantId,
      },
      select: {
        id: true,
        name: true,
        location: true,
        capacity: true,
        latitude: true,
        longitude: true,
        currentQueued: true,
      },
    });

    if (!terminal) {
      return bookingError(requestId, 'Terminal not found.', 404, 'TERMINAL_NOT_FOUND');
    }

    const updateData: {
      name?: string;
      location?: string;
      capacity?: number;
      latitude?: number;
      longitude?: number;
    } = {};

    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name.trim();
      const duplicate = await prisma.tODATerminal.findFirst({
        where: {
          tenantId,
          id: { not: terminal.id },
          name: {
            equals: updateData.name,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      if (duplicate) {
        return bookingError(requestId, 'A terminal with this name already exists.', 409, 'INVALID_REQUEST');
      }
    }

    if (parsed.data.location !== undefined) {
      updateData.location = parsed.data.location.trim();
    }

    if (parsed.data.capacity !== undefined) {
      const capacityError = getTerminalCapacityValidationError(parsed.data.capacity, terminal.currentQueued);
      if (capacityError) {
        return bookingError(requestId, capacityError, 400, 'INVALID_REQUEST');
      }
      updateData.capacity = parsed.data.capacity;
    }

    if (hasLatitude && hasLongitude) {
      updateData.latitude = parsed.data.latitude;
      updateData.longitude = parsed.data.longitude;
    }

    const updatedTerminal = await prisma.tODATerminal.update({
      where: { id: terminal.id },
      data: updateData,
    });

    await createTenantAuditLog({
      prisma,
      tenantId,
      actorUserId: user.id,
      module: AUDIT_MODULES.todas,
      action: 'toda.updated',
      targetType: 'toda_terminal',
      targetId: updatedTerminal.id,
      before: {
        name: terminal.name,
        location: terminal.location,
        capacity: terminal.capacity,
        latitude: terminal.latitude,
        longitude: terminal.longitude,
      },
      after: {
        name: updatedTerminal.name,
        location: updatedTerminal.location,
        capacity: updatedTerminal.capacity,
        latitude: updatedTerminal.latitude,
        longitude: updatedTerminal.longitude,
      },
    });

    return bookingSuccess(requestId, { terminal: updatedTerminal });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
