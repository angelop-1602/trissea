import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AUDIT_MODULES, createSuperadminTenantActionLogs } from '@/lib/audit-log';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { updateTenantWorkspaceMember } from '@/lib/dashboard/tenant-workspace';
import { getPrisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/superadmin-access';

interface Params {
  params: Promise<{ tenantId: string; membershipId: string }>;
}

const updateBodySchema = z
  .object({
    tenantRoleKey: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
    reason: z.string().trim().min(5).max(500),
  })
  .refine((value) => value.tenantRoleKey !== undefined || value.isActive !== undefined, {
    message: 'At least one update field is required.',
  });

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireSuperadmin(request);
    const { tenantId, membershipId } = await params;
    const json = await request.json().catch(() => null);
    const parsed = updateBodySchema.safeParse(json);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid team member update payload.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    const result = await updateTenantWorkspaceMember({
      prisma,
      tenantId,
      membershipId,
      tenantRoleKey: parsed.data.tenantRoleKey,
      isActive: parsed.data.isActive,
    });

    const action =
      parsed.data.tenantRoleKey !== undefined
        ? 'team.role_changed'
        : parsed.data.isActive
          ? 'team.member_reactivated'
          : 'team.member_deactivated';

    await createSuperadminTenantActionLogs({
      prisma,
      tenantId,
      superAdminUserId: user.id,
      module: AUDIT_MODULES.tenantTeam,
      action,
      targetType: 'tenant_membership',
      targetId: membershipId,
      reason: parsed.data.reason,
      accessType: 'team_support',
      before: result.before,
      after: {
        roleKey: result.member.tenantRoleKey,
        isActive: result.member.isActive,
      },
    });

    return bookingSuccess(requestId, {
      member: result.member,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
