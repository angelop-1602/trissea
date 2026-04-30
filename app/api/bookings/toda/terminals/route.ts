import { NextRequest } from 'next/server';
import { requireActorTenantId, requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { getPrisma } from '@/lib/prisma';
import { resolveTenantByCoordinates } from '@/lib/tenant-context';

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    const prisma = getPrisma();
    let tenantId: string;

    let driverContext:
      | {
          assignedTerminalId: string | null;
          visibilityScope: 'assigned_terminal_first' | 'tenant_wide';
        }
      | null = null;

    if (actor.role === 'passenger') {
      const latitude = parseCoordinate(request.nextUrl.searchParams.get('latitude'), -90, 90);
      const longitude = parseCoordinate(request.nextUrl.searchParams.get('longitude'), -180, 180);

      if (latitude === null || longitude === null) {
        return bookingError(
          requestId,
          'Passenger terminal lookup requires latitude and longitude query parameters.',
          400,
          'INVALID_REQUEST'
        );
      }

      const tenant = await resolveTenantByCoordinates({ latitude, longitude });
      tenantId = tenant.id;
    } else {
      tenantId = requireActorTenantId(actor);

      if (actor.role === 'driver') {
        const driverProfile = await prisma.driverProfile.findUnique({
          where: { userId: actor.id },
          select: { todaId: true },
        });

        driverContext = {
          assignedTerminalId: driverProfile?.todaId ?? null,
          visibilityScope: driverProfile?.todaId
            ? 'assigned_terminal_first'
            : 'tenant_wide',
        };
      }
    }

    const terminals = await prisma.tODATerminal.findMany({
      where: {
        tenantId,
      },
      orderBy: { name: 'asc' },
    });

    return bookingSuccess(requestId, {
      terminals,
      driverContext,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
