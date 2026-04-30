import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AUDIT_MODULES, createSuperadminTenantActionLogs } from '@/lib/audit-log';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { getTenantWorkspaceTeamData, inviteTenantWorkspaceMember } from '@/lib/dashboard/tenant-workspace';
import { getPrisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/superadmin-access';

interface Params {
  params: Promise<{ tenantId: string }>;
}

const inviteBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  tenantRoleKey: z.string().trim().min(1),
  reason: z.string().trim().min(5).max(500),
});

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    await requireSuperadmin(request);
    const { tenantId } = await params;
    const prisma = getPrisma();
    const data = await getTenantWorkspaceTeamData(prisma, tenantId);

    return bookingSuccess(requestId, data);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireSuperadmin(request);
    const { tenantId } = await params;
    const json = await request.json().catch(() => null);
    const parsed = inviteBodySchema.safeParse(json);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid invite payload.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    const result = await inviteTenantWorkspaceMember({
      prisma,
      tenantId,
      invitedByUserId: user.id,
      name: parsed.data.name,
      email: parsed.data.email,
      tenantRoleKey: parsed.data.tenantRoleKey,
    });

    await createSuperadminTenantActionLogs({
      prisma,
      tenantId,
      superAdminUserId: user.id,
      module: AUDIT_MODULES.tenantTeam,
      action: 'team.member_invited',
      targetType: 'tenant_membership',
      targetId: result.member.id,
      reason: parsed.data.reason,
      accessType: 'team_support',
      after: {
        userId: result.member.userId,
        name: result.member.name,
        email: result.member.email,
        roleKey: result.member.tenantRoleKey,
        isActive: result.member.isActive,
      },
    });

    return bookingSuccess(
      requestId,
      {
        member: result.member,
        temporaryPassword: result.temporaryPassword,
      },
      { status: 201 }
    );
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
