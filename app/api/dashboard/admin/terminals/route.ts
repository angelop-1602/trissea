import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { requireActorTenantId, requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { AUDIT_MODULES, createTenantAuditLog } from '@/lib/audit-log';

const createTerminalSchema = z.object({
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const DEFAULT_TERMINAL_CAPACITY = 35;

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    if (actor.role !== 'admin') {
      return bookingError(requestId, 'Only admins can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }
    const tenantId = requireActorTenantId(actor);

    const prisma = getPrisma();
    const terminals = await prisma.tODATerminal.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    const totalCapacity = terminals.reduce((sum, terminal) => sum + terminal.capacity, 0);
    const currentlyQueued = terminals.reduce((sum, terminal) => sum + terminal.currentQueued, 0);

    return bookingSuccess(requestId, {
      terminals,
      stats: {
        totalTerminals: terminals.length,
        totalCapacity,
        currentlyQueued,
      },
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

    if (actor.role !== 'admin') {
      return bookingError(requestId, 'Only admins can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }
    const tenantId = requireActorTenantId(actor);

    const body = await request.json().catch(() => null);
    const parsed = createTerminalSchema.safeParse(body);
    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    const name = parsed.data.name.trim();
    const location = parsed.data.location.trim();

    const duplicate = await prisma.tODATerminal.findFirst({
      where: {
        tenantId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      return bookingError(requestId, 'A terminal with this name already exists.', 409, 'INVALID_REQUEST');
    }

    const terminal = await prisma.tODATerminal.create({
      data: {
        id: randomUUID(),
        tenantId,
        name,
        location,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        capacity: DEFAULT_TERMINAL_CAPACITY,
        currentQueued: 0,
      },
    });

    await createTenantAuditLog({
      prisma,
      tenantId,
      actorUserId: user.id,
      module: AUDIT_MODULES.todas,
      action: 'toda.created',
      targetType: 'toda_terminal',
      targetId: terminal.id,
      after: {
        name: terminal.name,
        location: terminal.location,
        capacity: terminal.capacity,
      },
    });

    return bookingSuccess(requestId, { terminal });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
