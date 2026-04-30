import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ACTIVE_ON_DEMAND_DRIVER_STATUSES } from '@/lib/booking/types';
import { requireActorTenantId, requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { AUDIT_MODULES, createTenantAuditLog } from '@/lib/audit-log';
import { assertDriverRestrictionTransition } from '@/lib/driver-verification';
import { ensureTenantDriverProfiles, setDriverRestrictionState } from '@/lib/driver-domain';
import { getPrisma } from '@/lib/prisma';

interface Params {
  params: Promise<{ driverId: string }>;
}

const updateRestrictionSchema = z.object({
  isDriverRestricted: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const { driverId } = await params;
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    if (actor.role !== 'admin') {
      return bookingError(requestId, 'Only admins can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }
    const tenantId = requireActorTenantId(actor);

    const body = await request.json().catch(() => null);
    const parsed = updateRestrictionSchema.safeParse(body);
    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    await ensureTenantDriverProfiles(prisma, tenantId);
    const driver = await prisma.driverProfile.findFirst({
      where: {
        tenantId,
        userId: driverId,
      },
      select: {
        id: true,
        userId: true,
        verificationStatus: true,
        restrictionStatus: true,
        currentRestrictionReason: true,
        restrictedAt: true,
      },
    });

    if (!driver) {
      return bookingError(requestId, 'Driver not found.', 404, 'PROFILE_NOT_FOUND');
    }

    if (driver.verificationStatus !== 'verified') {
      return bookingError(
        requestId,
        'Driver must be verified before operational restrictions can be changed.',
        409,
        'INVALID_ACTION'
      );
    }

    const nextRestrictionState = parsed.data.isDriverRestricted;
    const isCurrentlyRestricted = driver.restrictionStatus === 'restricted';
    if (isCurrentlyRestricted === nextRestrictionState) {
      return bookingSuccess(requestId, {
        driver: {
          id: driver.userId,
          isDriverRestricted: isCurrentlyRestricted,
          driverRestrictionReason: driver.currentRestrictionReason,
          driverRestrictedAt: driver.restrictedAt,
        },
      });
    }

    const activeRide = nextRestrictionState
      ? await prisma.ride.findFirst({
          where: {
            tenantId,
            driverId: driver.userId,
            status: {
              in: ACTIVE_ON_DEMAND_DRIVER_STATUSES,
            },
          },
          select: { id: true },
        })
      : null;

    assertDriverRestrictionTransition({
      nextIsDriverRestricted: nextRestrictionState,
      hasActiveRide: Boolean(activeRide),
      reason: parsed.data.reason,
    });

    await setDriverRestrictionState({
      prisma,
      driverProfileId: driver.id,
      driverUserId: driver.userId,
      isRestricted: nextRestrictionState,
      actedByUserId: user.id,
      reason: parsed.data.reason,
    });

    if (nextRestrictionState) {
      await prisma.driverPresence.updateMany({
        where: { driverId: driver.userId },
        data: {
          isOnline: false,
          onlineSinceAt: null,
        },
      });
    }

    await createTenantAuditLog({
      prisma,
      tenantId,
      actorUserId: user.id,
      module: AUDIT_MODULES.drivers,
      action: nextRestrictionState ? 'driver.restricted' : 'driver.reinstated',
      targetType: 'driver_profile',
      targetId: driver.id,
      before: {
        restrictionStatus: driver.restrictionStatus,
        reason: driver.currentRestrictionReason,
      },
      after: {
        restrictionStatus: nextRestrictionState ? 'restricted' : 'unrestricted',
        reason: nextRestrictionState ? parsed.data.reason?.trim() ?? null : null,
      },
    });

    return bookingSuccess(requestId, {
      driver: {
        id: driver.userId,
        isDriverRestricted: nextRestrictionState,
        driverRestrictionReason: nextRestrictionState ? parsed.data.reason?.trim() ?? null : null,
        driverRestrictedAt: nextRestrictionState ? new Date() : null,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
