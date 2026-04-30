import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireActorTenantId, requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { computeAdminDriverStats } from '@/lib/admin-driver-management';
import { ensureTenantDriverProfiles, resolveDriverOperationalState } from '@/lib/driver-domain';

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
    await ensureTenantDriverProfiles(prisma, tenantId);
    const driverProfiles = await prisma.driverProfile.findMany({
      where: {
        tenantId,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            rating: true,
            completedRides: true,
            createdAt: true,
            DriverPresence: {
              select: {
                isOnline: true,
                onlineSinceAt: true,
                lastHeartbeatAt: true,
              },
            },
          },
        },
        TODATerminal: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const drivers = driverProfiles.map((profile) => {
      const isDriverVerified = profile.verificationStatus === 'verified';
      const isDriverRestricted = profile.restrictionStatus === 'restricted';
      const isOnline = Boolean(profile.User.DriverPresence?.isOnline);

      return {
        id: profile.User.id,
        driverProfileId: profile.id,
        name: profile.legalFullName ?? profile.User.name,
        email: profile.contactEmail ?? profile.User.email,
        phone: profile.contactPhone ?? profile.User.phone,
        todaName: profile.TODATerminal?.name ?? null,
        verificationStatus: profile.verificationStatus,
        restrictionStatus: profile.restrictionStatus,
        operationalState: resolveDriverOperationalState({
          verificationStatus: profile.verificationStatus,
          restrictionStatus: profile.restrictionStatus,
          isOnline,
        }),
        isDriverVerified,
        isDriverRestricted,
        rating: profile.User.rating,
        completedRides: profile.User.completedRides,
        createdAt: profile.User.createdAt,
        DriverPresence: profile.User.DriverPresence,
      };
    });

    const stats = computeAdminDriverStats(drivers);

    return bookingSuccess(requestId, {
      drivers,
      stats,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
