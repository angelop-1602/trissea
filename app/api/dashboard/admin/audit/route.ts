import { NextRequest } from 'next/server';
import { requireBookingProfile } from '@/lib/booking/auth';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { getPrisma } from '@/lib/prisma';
import { requireTenantMembershipWithPermissions, TENANT_PERMISSION_KEYS } from '@/lib/tenant-rbac';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const prisma = getPrisma() as ReturnType<typeof getPrisma> & {
      tenantAuditLog: {
        findMany: (args: unknown) => Promise<any[]>;
      };
    };
    const user = await requireBookingProfile(request);
    const access = await requireTenantMembershipWithPermissions(prisma, user, TENANT_PERMISSION_KEYS.auditView);
    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module')?.trim() || undefined;
    const action = searchParams.get('action')?.trim() || undefined;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const logs = await prisma.tenantAuditLog.findMany({
      where: {
        tenantId: access.tenantId,
        ...(module ? { module } : {}),
        ...(action ? { action } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        ActorUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return bookingSuccess(requestId, {
      logs: logs.map((log: any) => ({
        id: log.id,
        module: log.module,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        beforeJson: log.beforeJson,
        afterJson: log.afterJson,
        createdAt: log.createdAt,
        actor: log.ActorUser,
      })),
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
