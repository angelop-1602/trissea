import { NextRequest, NextResponse } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthError } from '@/lib/auth';
import { requireBookingProfile } from '@/lib/booking/auth';
import { BookingError } from '@/lib/booking/errors';
import { ensureDriverProfileForUser } from '@/lib/driver-domain';
import { getPrisma } from '@/lib/prisma';
import { resolveDriverAccessState } from '@/lib/driver-access';

const driverAccountSchema = z.object({
  contactEmail: z
    .union([z.string().trim().email().max(160), z.literal(''), z.null()])
    .optional(),
  homeAddress: z
    .union([z.string().trim().max(240), z.literal(''), z.null()])
    .optional(),
});

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  if (error instanceof BookingError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: error.issues[0]?.message ?? 'Invalid driver account payload.',
        code: 'INVALID_DRIVER_ACCOUNT_PAYLOAD',
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: 'Unable to load the driver account.' },
    { status: 500 },
  );
}

async function buildDriverAccountPayload(prisma: PrismaClient, userId: string) {
  const driver = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      tenantId: true,
      name: true,
      email: true,
      phone: true,
      phoneE164: true,
      createdAt: true,
      updatedAt: true,
      isDriverVerified: true,
      isDriverRestricted: true,
      driverRestrictionReason: true,
      driverRestrictedAt: true,
    },
  });

  if (!driver || driver.role !== 'driver') {
    throw new BookingError('Driver profile not found.', 404, 'PROFILE_NOT_FOUND');
  }

  if (driver.tenantId) {
    await ensureDriverProfileForUser(prisma, driver);
  }

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: driver.id },
    select: {
      id: true,
      todaId: true,
      legalFullName: true,
      contactEmail: true,
      contactPhone: true,
      dateOfBirth: true,
      homeAddress: true,
      todaMembershipId: true,
      licenseNumber: true,
      licenseExpiry: true,
      vehicleType: true,
      plateNumber: true,
      vehicleModel: true,
      vehicleColor: true,
      operationalState: true,
      verificationStatus: true,
      restrictionStatus: true,
      verificationApprovedAt: true,
      lastVerificationReviewAt: true,
      restrictedAt: true,
      currentRestrictionReason: true,
      TODATerminal: {
        select: {
          id: true,
          name: true,
          location: true,
          capacity: true,
          currentQueued: true,
        },
      },
      DriverDocuments: {
        select: {
          id: true,
          documentType: true,
          reviewStatus: true,
          submittedAt: true,
          reviewedAt: true,
          remarks: true,
          ReviewedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      },
    },
  });

  const [presence, latestVerificationReview, latestRestrictionLog] =
    await Promise.all([
      prisma.driverPresence.findUnique({
        where: { driverId: driver.id },
        select: {
          isOnline: true,
          onlineSinceAt: true,
          lastHeartbeatAt: true,
        },
      }),
      profile
        ? prisma.driverVerificationReview.findFirst({
            where: {
              driverProfileId: profile.id,
            },
            select: {
              decision: true,
              remarks: true,
              createdAt: true,
              ReviewedByUser: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve(null),
      profile
        ? prisma.driverRestrictionLog.findFirst({
            where: {
              driverProfileId: profile.id,
            },
            select: {
              action: true,
              reason: true,
              createdAt: true,
              ActedByUser: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve(null),
    ]);

  const documents = profile?.DriverDocuments ?? [];
  const documentSummary = {
    total: documents.length,
    submitted: documents.filter((document) => document.reviewStatus === 'submitted')
      .length,
    approved: documents.filter((document) => document.reviewStatus === 'approved')
      .length,
    rejected: documents.filter((document) => document.reviewStatus === 'rejected')
      .length,
  };

  return {
    user: {
      id: driver.id,
      role: driver.role,
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      phoneE164: driver.phoneE164,
      createdAt: driver.createdAt,
      isDriverVerified: driver.isDriverVerified,
      isDriverRestricted: driver.isDriverRestricted,
      driverRestrictionReason: profile?.currentRestrictionReason ?? driver.driverRestrictionReason,
      driverRestrictedAt: profile?.restrictedAt ?? driver.driverRestrictedAt,
    },
    accessState: resolveDriverAccessState({
      role: driver.role,
      isDriverVerified: profile
        ? profile.verificationStatus === 'verified'
        : driver.isDriverVerified,
      isDriverRestricted: profile
        ? profile.restrictionStatus === 'restricted'
        : driver.isDriverRestricted,
    }),
    profile: {
      legalFullName: profile?.legalFullName ?? driver.name,
      contactEmail: profile?.contactEmail ?? driver.email,
      contactPhone: profile?.contactPhone ?? driver.phone,
      dateOfBirth: profile?.dateOfBirth ?? null,
      homeAddress: profile?.homeAddress ?? null,
      todaMembershipId: profile?.todaMembershipId ?? null,
      licenseNumber: profile?.licenseNumber ?? null,
      licenseExpiry: profile?.licenseExpiry ?? null,
      vehicleType: profile?.vehicleType ?? null,
      plateNumber: profile?.plateNumber ?? null,
      vehicleModel: profile?.vehicleModel ?? null,
      vehicleColor: profile?.vehicleColor ?? null,
      operationalState: profile?.operationalState ?? 'pending_review',
      verificationStatus: profile?.verificationStatus ?? 'pending',
      restrictionStatus: profile?.restrictionStatus ?? 'unrestricted',
      verificationApprovedAt: profile?.verificationApprovedAt ?? null,
      lastVerificationReviewAt: profile?.lastVerificationReviewAt ?? null,
      restrictedAt: profile?.restrictedAt ?? null,
      toda: profile?.TODATerminal ?? null,
      visibilityScope: profile?.todaId
        ? 'assigned_terminal_first'
        : 'tenant_wide',
    },
    presence: {
      isOnline: presence?.isOnline ?? false,
      onlineSinceAt: presence?.onlineSinceAt ?? null,
      lastHeartbeatAt: presence?.lastHeartbeatAt ?? null,
    },
    documents: documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      reviewStatus: document.reviewStatus,
      submittedAt: document.submittedAt,
      reviewedAt: document.reviewedAt,
      remarks: document.remarks,
      reviewedBy: document.ReviewedByUser,
    })),
    documentSummary,
    latestVerificationReview: latestVerificationReview
      ? {
          decision: latestVerificationReview.decision,
          remarks: latestVerificationReview.remarks,
          createdAt: latestVerificationReview.createdAt,
          reviewedBy: latestVerificationReview.ReviewedByUser,
        }
      : null,
    latestRestrictionLog: latestRestrictionLog
      ? {
          action: latestRestrictionLog.action,
          reason: latestRestrictionLog.reason,
          createdAt: latestRestrictionLog.createdAt,
          actedBy: latestRestrictionLog.ActedByUser,
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireBookingProfile(request, {
      allowPendingDriver: true,
      allowRestrictedDriver: true,
    });

    if (user.role !== 'driver') {
      return NextResponse.json(
        { error: 'Only drivers can access this endpoint.', code: 'FORBIDDEN_ROLE' },
        { status: 403 },
      );
    }

    const prisma = getPrisma();
    const account = await buildDriverAccountPayload(prisma, user.id);

    return NextResponse.json({ account });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireBookingProfile(request, {
      allowPendingDriver: true,
      allowRestrictedDriver: true,
    });

    if (user.role !== 'driver') {
      return NextResponse.json(
        { error: 'Only drivers can access this endpoint.', code: 'FORBIDDEN_ROLE' },
        { status: 403 },
      );
    }

    if (!user.tenantId) {
      throw new BookingError(
        'Driver tenant context is required.',
        400,
        'TENANT_REQUIRED',
      );
    }

    const payload = driverAccountSchema.parse(await request.json());
    const prisma = getPrisma();

    await ensureDriverProfileForUser(prisma, user);

    const contactEmail =
      payload.contactEmail !== undefined
        ? normalizeOptionalString(payload.contactEmail)
        : undefined;
    const homeAddress =
      payload.homeAddress !== undefined
        ? normalizeOptionalString(payload.homeAddress)
        : undefined;

    await prisma.$transaction(async (tx) => {
      if (payload.contactEmail !== undefined) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            email: contactEmail,
          },
        });
      }

      await tx.driverProfile.update({
        where: { userId: user.id },
        data: {
          ...(payload.contactEmail !== undefined
            ? { contactEmail }
            : {}),
          ...(payload.homeAddress !== undefined
            ? { homeAddress }
            : {}),
        },
      });
    });

    const account = await buildDriverAccountPayload(prisma, user.id);
    return NextResponse.json({ account });
  } catch (error) {
    return toErrorResponse(error);
  }
}
