import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { BookingError } from '@/lib/booking/errors';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { createSupportAccessLog } from '@/lib/audit-log';
import { getPrisma } from '@/lib/prisma';

const bodySchema = z.object({
  tenantId: z.string().trim().min(1),
  accessType: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(5).max(500),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    if (actor.role !== 'superadmin') {
      return bookingError(requestId, 'Only superadmins can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }

    const prisma = getPrisma() as ReturnType<typeof getPrisma> & {
      supportAccessLog: {
        findMany: (args: unknown) => Promise<any[]>;
      };
    };
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId')?.trim() || undefined;
    const accessType = searchParams.get('accessType')?.trim() || undefined;

    const [logs, tenants] = await Promise.all([
      prisma.supportAccessLog.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          ...(accessType ? { accessType } : {}),
        },
        include: {
          Tenant: {
            select: {
              id: true,
              name: true,
              lguName: true,
            },
          },
          SuperAdminUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          lguName: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return bookingSuccess(requestId, {
      logs: logs.map((log: any) => ({
        id: log.id,
        accessType: log.accessType,
        reason: log.reason,
        createdAt: log.createdAt,
        tenant: log.Tenant,
        superAdmin: log.SuperAdminUser,
      })),
      tenants,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    if (actor.role !== 'superadmin') {
      return bookingError(requestId, 'Only superadmins can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BookingError('Invalid support access payload.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma() as ReturnType<typeof getPrisma> & {
      supportAccessLog: {
        create: (args: unknown) => Promise<unknown>;
      };
    };
    const tenant = await prisma.tenant.findUnique({
      where: { id: parsed.data.tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new BookingError('Tenant not found.', 404, 'TENANT_REQUIRED');
    }

    await createSupportAccessLog({
      prisma,
      tenantId: parsed.data.tenantId,
      superAdminUserId: user.id,
      accessType: parsed.data.accessType,
      reason: parsed.data.reason,
    });

    return bookingSuccess(requestId, { ok: true }, { status: 201 });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
