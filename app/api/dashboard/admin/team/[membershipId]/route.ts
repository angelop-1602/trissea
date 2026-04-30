import { NextRequest } from 'next/server';
import { z } from 'zod';
import { BookingError } from '@/lib/booking/errors';
import { requireBookingProfile } from '@/lib/booking/auth';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { AUDIT_MODULES, createTenantAuditLog } from '@/lib/audit-log';
import { getPrisma } from '@/lib/prisma';
import { mapTenantTeamMemberRow } from '@/lib/admin-team';
import {
  requireTenantMembershipWithPermissions,
  TENANT_PERMISSION_KEYS,
  type TenantPermissionKey,
} from '@/lib/tenant-rbac';

const updateBodySchema = z
  .object({
    tenantRoleKey: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.tenantRoleKey !== undefined || value.isActive !== undefined, {
    message: 'At least one update field is required.',
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const prisma = getPrisma();
    const user = await requireBookingProfile(request);
    const { membershipId } = await params;
    const json = await request.json().catch(() => null);
    const parsed = updateBodySchema.safeParse(json);

    if (!parsed.success) {
      throw new BookingError('Invalid team member update payload.', 400, 'INVALID_REQUEST');
    }

    const requiredPermissions: TenantPermissionKey[] = [];
    if (parsed.data.tenantRoleKey !== undefined) {
      requiredPermissions.push(TENANT_PERMISSION_KEYS.teamRolesManage);
    }
    if (parsed.data.isActive !== undefined) {
      requiredPermissions.push(TENANT_PERMISSION_KEYS.teamMembersManageStatus);
    }

    const access = await requireTenantMembershipWithPermissions(prisma, user, requiredPermissions);

    const existingMembership = await prisma.tenantMembership.findUnique({
      where: { id: membershipId },
      include: {
        User: true,
        TenantRole: true,
      },
    });

    if (!existingMembership || existingMembership.tenantId !== access.tenantId) {
      throw new BookingError('Tenant team member not found.', 404, 'PROFILE_NOT_FOUND');
    }

    if (existingMembership.userId === user.id) {
      throw new BookingError('You cannot change your own tenant team membership from this screen.', 400, 'INVALID_ACTION');
    }

    const nextRole =
      parsed.data.tenantRoleKey !== undefined
        ? await prisma.tenantRole.findUnique({ where: { key: parsed.data.tenantRoleKey } })
        : existingMembership.TenantRole;

    if (!nextRole) {
      throw new BookingError('Selected tenant role was not found.', 404, 'PROFILE_NOT_FOUND');
    }

    const nextIsActive = parsed.data.isActive ?? existingMembership.isActive;
    const ownerRoleKeys = new Set(['tenant_owner']);
    const ownerStateChanging =
      ownerRoleKeys.has(existingMembership.TenantRole.key) &&
      (!nextIsActive || nextRole.key !== existingMembership.TenantRole.key);

    if (ownerStateChanging) {
      const activeOwnerCount = await prisma.tenantMembership.count({
        where: {
          tenantId: access.tenantId,
          isActive: true,
          TenantRole: {
            key: 'tenant_owner',
          },
        },
      });

      if (activeOwnerCount <= 1) {
        throw new BookingError('Each tenant must keep at least one active tenant owner.', 400, 'INVALID_ACTION');
      }
    }

    const updatedMembership = await prisma.$transaction(async (tx) => {
      const membership = await tx.tenantMembership.update({
        where: { id: membershipId },
        data: {
          tenantRoleId: nextRole.id,
          isActive: nextIsActive,
          deactivatedAt: nextIsActive ? null : new Date(),
          updatedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: existingMembership.userId },
        data: {
          tenantId: access.tenantId,
          role: 'admin',
          updatedAt: new Date(),
        },
      });

      return membership;
    });

    const hydratedMembership = await prisma.tenantMembership.findUniqueOrThrow({
      where: { id: updatedMembership.id },
      include: {
        User: {
          select: {
            name: true,
            email: true,
          },
        },
        TenantRole: {
          select: {
            key: true,
            name: true,
          },
        },
        InvitedByUser: {
          select: {
            name: true,
          },
        },
      },
    });

    const action =
      parsed.data.tenantRoleKey !== undefined
        ? 'team.role_changed'
        : nextIsActive
          ? 'team.member_reactivated'
          : 'team.member_deactivated';

    await createTenantAuditLog({
      prisma,
      tenantId: access.tenantId,
      actorUserId: user.id,
      module: AUDIT_MODULES.tenantTeam,
      action,
      targetType: 'tenant_membership',
      targetId: hydratedMembership.id,
      before: {
        roleKey: existingMembership.TenantRole.key,
        isActive: existingMembership.isActive,
      },
      after: {
        roleKey: hydratedMembership.TenantRole.key,
        isActive: hydratedMembership.isActive,
      },
    });

    return bookingSuccess(requestId, {
      member: mapTenantTeamMemberRow(hydratedMembership),
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
