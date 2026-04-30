import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AUDIT_MODULES, createPlatformAuditLog, createSuperadminTenantActionLogs } from '@/lib/audit-log';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { getPlatformPassengerProfileData, updatePlatformPassengerProfile } from '@/lib/dashboard/platform-control';
import { getPrisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/superadmin-access';

interface Params {
  params: Promise<{ passengerId: string }>;
}

const updatePassengerSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.union([z.string().trim().email().max(160), z.literal(''), z.null()]).optional(),
    emergencyContactName: z.union([z.string().trim().max(120), z.literal(''), z.null()]).optional(),
    emergencyContactPhone: z.union([z.string().trim().max(40), z.literal(''), z.null()]).optional(),
    reason: z.string().trim().min(5).max(500),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.email !== undefined ||
      value.emergencyContactName !== undefined ||
      value.emergencyContactPhone !== undefined,
    {
      message: 'At least one passenger field is required.',
    }
  );

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    await requireSuperadmin(request);
    const { passengerId } = await params;
    const prisma = getPrisma();
    const data = await getPlatformPassengerProfileData(prisma, passengerId);

    return bookingSuccess(requestId, data);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireSuperadmin(request);
    const { passengerId } = await params;
    const json = await request.json().catch(() => null);
    const parsed = updatePassengerSchema.safeParse(json);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid passenger payload.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    const result = await updatePlatformPassengerProfile({
      prisma,
      passengerId,
      input: {
        name: parsed.data.name,
        email: parsed.data.email === '' ? null : parsed.data.email,
        emergencyContactName:
          parsed.data.emergencyContactName === '' ? null : parsed.data.emergencyContactName,
        emergencyContactPhone:
          parsed.data.emergencyContactPhone === '' ? null : parsed.data.emergencyContactPhone,
      },
    });

    if (result.passenger.tenantId) {
      await createSuperadminTenantActionLogs({
        prisma,
        tenantId: result.passenger.tenantId,
        superAdminUserId: user.id,
        module: AUDIT_MODULES.passengers,
        action: 'passenger.profile_corrected',
        targetType: 'passenger',
        targetId: passengerId,
        reason: parsed.data.reason,
        accessType: 'passenger_support',
        before: result.before,
        after: result.after,
      });
    } else {
      await createPlatformAuditLog({
        prisma,
        actorUserId: user.id,
        module: AUDIT_MODULES.passengers,
        action: 'passenger.profile_corrected',
        targetType: 'passenger',
        targetId: passengerId,
        reason: parsed.data.reason,
        before: result.before,
        after: result.after,
      });
    }

    return bookingSuccess(requestId, {
      passenger: {
        id: result.passenger.id,
        name: result.passenger.name,
        email: result.passenger.email,
        emergencyContactName: result.passenger.emergencyContactName,
        emergencyContactPhone: result.passenger.emergencyContactPhone,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
