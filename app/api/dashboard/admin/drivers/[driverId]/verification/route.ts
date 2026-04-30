import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireActorTenantId, requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { AUDIT_MODULES, createTenantAuditLog } from '@/lib/audit-log';
import { assertDriverVerificationTransition } from '@/lib/driver-verification';
import { approveDriverProfile, ensureTenantDriverProfiles } from '@/lib/driver-domain';
import { getPrisma } from '@/lib/prisma';

interface Params {
  params: Promise<{ driverId: string }>;
}

const updateVerificationSchema = z.object({
  isDriverVerified: z.boolean(),
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
    const parsed = updateVerificationSchema.safeParse(body);
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
      },
    });

    if (!driver) {
      return bookingError(requestId, 'Driver not found.', 404, 'PROFILE_NOT_FOUND');
    }

    const nextVerificationState = parsed.data.isDriverVerified;
    const isCurrentlyVerified = driver.verificationStatus === 'verified';
    if (isCurrentlyVerified === nextVerificationState) {
      return bookingSuccess(requestId, { driver });
    }

    assertDriverVerificationTransition({
      currentIsDriverVerified: isCurrentlyVerified,
      nextIsDriverVerified: nextVerificationState,
    });

    await approveDriverProfile({
      prisma,
      driverProfileId: driver.id,
      driverUserId: driver.userId,
      reviewedByUserId: user.id,
    });

    await createTenantAuditLog({
      prisma,
      tenantId,
      actorUserId: user.id,
      module: AUDIT_MODULES.drivers,
      action: 'driver.approved',
      targetType: 'driver_profile',
      targetId: driver.id,
      before: {
        verificationStatus: driver.verificationStatus,
      },
      after: {
        verificationStatus: 'verified',
      },
    });

    return bookingSuccess(requestId, {
      driver: {
        id: driver.userId,
        isDriverVerified: true,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
