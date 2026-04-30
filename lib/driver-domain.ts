import type {
  DriverOperationalState,
  DriverRestrictionAction,
  DriverRestrictionStatus,
  DriverVerificationDecision,
  DriverVerificationStatus,
  Prisma,
  PrismaClient,
  Tenant,
  User,
} from '@prisma/client';

type PrismaTx = Prisma.TransactionClient | PrismaClient;

export type DriverOnboardingInput = {
  legalFullName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | Date | null;
  homeAddress?: string | null;
  todaMembershipId?: string | null;
  licenseNumber?: string | null;
  licenseExpiry?: string | Date | null;
  vehicleType?: string | null;
  plateNumber?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
};

export function resolveDriverVerificationStatus(
  isDriverVerified: boolean | null | undefined
): DriverVerificationStatus {
  return isDriverVerified ? 'verified' : 'pending';
}

export function resolveDriverRestrictionStatus(
  isDriverRestricted: boolean | null | undefined
): DriverRestrictionStatus {
  return isDriverRestricted ? 'restricted' : 'unrestricted';
}

export function resolveDriverOperationalState(input: {
  verificationStatus: DriverVerificationStatus;
  restrictionStatus: DriverRestrictionStatus;
  isOnline?: boolean | null;
}): DriverOperationalState {
  if (input.restrictionStatus === 'restricted') {
    return 'restricted';
  }

  if (input.verificationStatus !== 'verified') {
    return 'pending_review';
  }

  if (input.isOnline) {
    return 'online';
  }

  return 'offline';
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function createDriverAccessSnapshot(input: {
  user: Pick<User, 'role' | 'isDriverVerified' | 'isDriverRestricted'>;
  driverProfile?: {
    verificationStatus: DriverVerificationStatus;
    restrictionStatus: DriverRestrictionStatus;
  } | null;
}) {
  const verificationStatus =
    input.driverProfile?.verificationStatus ?? resolveDriverVerificationStatus(input.user.isDriverVerified);
  const restrictionStatus =
    input.driverProfile?.restrictionStatus ?? resolveDriverRestrictionStatus(input.user.isDriverRestricted);

  return {
    role: input.user.role,
    isDriverVerified: verificationStatus === 'verified',
    isDriverRestricted: restrictionStatus === 'restricted',
  };
}

export async function ensureDriverProfileForUser(
  prisma: PrismaTx,
  user: Pick<
    User,
    | 'id'
    | 'role'
    | 'tenantId'
    | 'email'
    | 'phone'
    | 'phoneE164'
    | 'name'
    | 'isDriverVerified'
    | 'isDriverRestricted'
    | 'driverRestrictionReason'
    | 'driverRestrictedAt'
    | 'createdAt'
    | 'updatedAt'
  >,
  onboarding?: DriverOnboardingInput
) {
  if (user.role !== 'driver' || !user.tenantId) {
    return null;
  }

  const existing = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      verificationApprovedAt: true,
      lastVerificationReviewAt: true,
      todaId: true,
      createdAt: true,
    },
  });
  const verificationStatus = resolveDriverVerificationStatus(user.isDriverVerified);
  const restrictionStatus = resolveDriverRestrictionStatus(user.isDriverRestricted);
  const profileId = existing?.id ?? `driver-profile-${user.id}`;
  const approvalTimestamp =
    verificationStatus === 'verified'
      ? existing?.verificationApprovedAt ?? user.updatedAt
      : null;
  const reviewTimestamp =
    verificationStatus === 'verified'
      ? existing?.lastVerificationReviewAt ?? user.updatedAt
      : null;

  return prisma.driverProfile.upsert({
    where: { userId: user.id },
    update: {
      tenantId: user.tenantId,
      legalFullName: normalizeOptionalString(onboarding?.legalFullName) ?? user.name,
      contactEmail: normalizeOptionalString(onboarding?.email) ?? user.email ?? null,
      contactPhone:
        normalizeOptionalString(onboarding?.phone) ?? normalizeOptionalString(user.phoneE164) ?? user.phone ?? null,
      dateOfBirth: normalizeOptionalDate(onboarding?.dateOfBirth),
      homeAddress: normalizeOptionalString(onboarding?.homeAddress),
      todaMembershipId: normalizeOptionalString(onboarding?.todaMembershipId),
      licenseNumber: normalizeOptionalString(onboarding?.licenseNumber),
      licenseExpiry: normalizeOptionalDate(onboarding?.licenseExpiry),
      vehicleType: normalizeOptionalString(onboarding?.vehicleType),
      plateNumber: normalizeOptionalString(onboarding?.plateNumber),
      vehicleModel: normalizeOptionalString(onboarding?.vehicleModel),
      vehicleColor: normalizeOptionalString(onboarding?.vehicleColor),
      verificationStatus,
      restrictionStatus,
      operationalState: resolveDriverOperationalState({ verificationStatus, restrictionStatus }),
      currentRestrictionReason: user.driverRestrictionReason ?? null,
      restrictedAt: user.driverRestrictedAt ?? null,
      verificationApprovedAt: approvalTimestamp,
      lastVerificationReviewAt: reviewTimestamp,
      updatedAt: new Date(),
    },
    create: {
      id: profileId,
      userId: user.id,
      tenantId: user.tenantId,
      legalFullName: normalizeOptionalString(onboarding?.legalFullName) ?? user.name,
      contactEmail: normalizeOptionalString(onboarding?.email) ?? user.email ?? null,
      contactPhone:
        normalizeOptionalString(onboarding?.phone) ?? normalizeOptionalString(user.phoneE164) ?? user.phone ?? null,
      dateOfBirth: normalizeOptionalDate(onboarding?.dateOfBirth),
      homeAddress: normalizeOptionalString(onboarding?.homeAddress),
      todaMembershipId: normalizeOptionalString(onboarding?.todaMembershipId),
      licenseNumber: normalizeOptionalString(onboarding?.licenseNumber),
      licenseExpiry: normalizeOptionalDate(onboarding?.licenseExpiry),
      vehicleType: normalizeOptionalString(onboarding?.vehicleType),
      plateNumber: normalizeOptionalString(onboarding?.plateNumber),
      vehicleModel: normalizeOptionalString(onboarding?.vehicleModel),
      vehicleColor: normalizeOptionalString(onboarding?.vehicleColor),
      verificationStatus,
      restrictionStatus,
      operationalState: resolveDriverOperationalState({ verificationStatus, restrictionStatus }),
      currentRestrictionReason: user.driverRestrictionReason ?? null,
      restrictedAt: user.driverRestrictedAt ?? null,
      verificationApprovedAt: approvalTimestamp,
      lastVerificationReviewAt: reviewTimestamp,
      createdAt: existing?.createdAt ?? user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}

export async function createDriverOnboardingDocuments(
  prisma: PrismaTx,
  driverProfileId: string,
  onboarding: DriverOnboardingInput
) {
  const documents: Prisma.DriverDocumentCreateManyInput[] = [];
  const licenseNumber = normalizeOptionalString(onboarding.licenseNumber);
  const licenseExpiry = normalizeOptionalDate(onboarding.licenseExpiry);
  const todaMembershipId = normalizeOptionalString(onboarding.todaMembershipId);

  if (licenseNumber) {
    documents.push({
      id: `driver-document-license-${driverProfileId}`,
      driverProfileId,
      documentType: 'drivers_license',
      fileUrl: null,
      storageRef: null,
      reviewStatus: 'submitted',
      metadata: {
        source: 'onboarding_metadata',
        licenseNumber,
        licenseExpiry: licenseExpiry?.toISOString() ?? null,
      } as Prisma.InputJsonValue,
      remarks: 'Metadata captured during driver onboarding. File upload not yet enabled.',
    });
  }

  if (todaMembershipId) {
    documents.push({
      id: `driver-document-membership-${driverProfileId}`,
      driverProfileId,
      documentType: 'toda_membership',
      fileUrl: null,
      storageRef: null,
      reviewStatus: 'submitted',
      metadata: {
        source: 'onboarding_metadata',
        todaMembershipId,
      } as Prisma.InputJsonValue,
      remarks: 'Metadata captured during driver onboarding. File upload not yet enabled.',
    });
  }

  if (documents.length > 0) {
    await prisma.driverDocument.createMany({
      data: documents,
      skipDuplicates: true,
    });
  }
}

export async function getDriverProfileByUserId(prisma: PrismaTx, userId: string) {
  return prisma.driverProfile.findUnique({
    where: { userId },
  });
}

export async function ensureTenantDriverProfiles(prisma: PrismaTx, tenantId: string) {
  const legacyDrivers = await prisma.user.findMany({
    where: {
      tenantId,
      role: 'driver',
      DriverProfile: null,
    },
    select: {
      id: true,
      role: true,
      tenantId: true,
      email: true,
      phone: true,
      phoneE164: true,
      name: true,
      isDriverVerified: true,
      isDriverRestricted: true,
      driverRestrictionReason: true,
      driverRestrictedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  for (const driver of legacyDrivers) {
    await ensureDriverProfileForUser(prisma, driver);
  }
}

export async function syncDriverProfileAfterPresenceUpdate(
  prisma: PrismaTx,
  input: { driverId: string; isOnline: boolean }
) {
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: input.driverId },
    select: {
      id: true,
      verificationStatus: true,
      restrictionStatus: true,
    },
  });

  if (!driverProfile) return;

  await prisma.driverProfile.update({
    where: { id: driverProfile.id },
    data: {
      operationalState: resolveDriverOperationalState({
        verificationStatus: driverProfile.verificationStatus,
        restrictionStatus: driverProfile.restrictionStatus,
        isOnline: input.isOnline,
      }),
      updatedAt: new Date(),
    },
  });
}

export async function approveDriverProfile(params: {
  prisma: PrismaTx;
  driverProfileId: string;
  driverUserId: string;
  reviewedByUserId?: string | null;
  remarks?: string | null;
}) {
  const now = new Date();
  await params.prisma.driverProfile.update({
    where: { id: params.driverProfileId },
    data: {
      verificationStatus: 'verified',
      restrictionStatus: 'unrestricted',
      operationalState: 'offline',
      verificationApprovedAt: now,
      lastVerificationReviewAt: now,
      currentRestrictionReason: null,
      restrictedAt: null,
      updatedAt: now,
    },
  });

  await params.prisma.user.update({
    where: { id: params.driverUserId },
    data: {
      isDriverVerified: true,
      isDriverRestricted: false,
      driverRestrictionReason: null,
      driverRestrictedAt: null,
      updatedAt: now,
    },
  });

  await params.prisma.driverVerificationReview.create({
    data: {
      id: `driver-verification-review-${params.driverProfileId}-${now.getTime()}`,
      driverProfileId: params.driverProfileId,
      decision: 'approved',
      reviewedByUserId: params.reviewedByUserId ?? null,
      remarks: normalizeOptionalString(params.remarks) ?? 'Driver approved for operations.',
      createdAt: now,
    },
  });
}

export async function setDriverRestrictionState(params: {
  prisma: PrismaTx;
  driverProfileId: string;
  driverUserId: string;
  isRestricted: boolean;
  actedByUserId?: string | null;
  reason?: string | null;
}) {
  const now = new Date();
  const restrictionStatus: DriverRestrictionStatus = params.isRestricted ? 'restricted' : 'unrestricted';

  const current = await params.prisma.driverProfile.findUnique({
    where: { id: params.driverProfileId },
    select: {
      verificationStatus: true,
    },
  });

  const operationalState = resolveDriverOperationalState({
    verificationStatus: current?.verificationStatus ?? 'pending',
    restrictionStatus,
    isOnline: false,
  });

  await params.prisma.driverProfile.update({
    where: { id: params.driverProfileId },
    data: {
      restrictionStatus,
      operationalState,
      currentRestrictionReason: params.isRestricted ? normalizeOptionalString(params.reason) : null,
      restrictedAt: params.isRestricted ? now : null,
      updatedAt: now,
    },
  });

  await params.prisma.user.update({
    where: { id: params.driverUserId },
    data: {
      isDriverRestricted: params.isRestricted,
      driverRestrictionReason: params.isRestricted ? normalizeOptionalString(params.reason) : null,
      driverRestrictedAt: params.isRestricted ? now : null,
      updatedAt: now,
    },
  });

  await params.prisma.driverRestrictionLog.create({
    data: {
      id: `driver-restriction-log-${params.driverProfileId}-${now.getTime()}`,
      driverProfileId: params.driverProfileId,
      action: params.isRestricted ? 'restricted' : 'reinstated',
      actedByUserId: params.actedByUserId ?? null,
      reason: normalizeOptionalString(params.reason),
      createdAt: now,
    },
  });
}

export function resolveDriverTodaAssignment(
  tenant: Pick<Tenant, 'id'> | null | undefined,
  todaId: string | null | undefined
) {
  if (!tenant?.id) return null;
  return todaId ?? null;
}
