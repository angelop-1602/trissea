import { NextRequest } from 'next/server';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import {
  bookingError,
  bookingErrorResponse,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { quoteInputSchema } from '@/lib/booking/schemas';
import { createOnDemandRide, listActiveRideForPassenger } from '@/lib/booking/service';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';
import { logInfo } from '@/lib/observability/log';
import { resolveTenantByCoordinates } from '@/lib/tenant-context';

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const body = await request.json().catch(() => null);
    const parsed = quoteInputSchema.safeParse(body);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const actor = toBookingActor(user);
    if (actor.role !== 'passenger') {
      return bookingError(requestId, 'Only passengers can create rides.', 403, 'FORBIDDEN_ROLE');
    }

    const limit = await checkEndpointRateLimit(request, {
      scope: 'bookings.on_demand.create',
      limit: 10,
      windowMs: 60_000,
      keyParts: [actor.id],
    });

    if (!limit.allowed) {
      return rateLimitedResponse(requestId, limit.retryAfterSeconds);
    }

    const existing = await listActiveRideForPassenger(actor);
    if (existing) {
      return bookingSuccess(
        requestId,
        { ride: existing },
        {
          meta: {
            idempotent: true,
          },
        }
      );
    }

    const tenant = await resolveTenantByCoordinates(parsed.data.pickup);
    const tenantScopedActor = {
      ...actor,
      tenantId: tenant.id,
    };
    const ride = await createOnDemandRide(parsed.data, tenantScopedActor);
    logInfo('booking.on_demand.created', {
      requestId,
      route: '/api/bookings/on-demand',
      userId: actor.id,
      tenantId: tenant.id,
      code: 'RIDE_CREATED',
      rideId: ride.id,
    });

    return bookingSuccess(requestId, { ride });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    if (actor.role !== 'passenger') {
      return bookingError(requestId, 'Only passengers can fetch active ride.', 403, 'FORBIDDEN_ROLE');
    }

    const ride = await listActiveRideForPassenger(actor);
    return bookingSuccess(requestId, { ride });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
