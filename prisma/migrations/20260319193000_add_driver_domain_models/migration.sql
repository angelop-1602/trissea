CREATE TYPE "public"."DriverOperationalState" AS ENUM ('pending_review', 'offline', 'online', 'restricted');
CREATE TYPE "public"."DriverVerificationStatus" AS ENUM ('pending', 'verified');
CREATE TYPE "public"."DriverRestrictionStatus" AS ENUM ('unrestricted', 'restricted');
CREATE TYPE "public"."DriverDocumentType" AS ENUM (
  'drivers_license',
  'toda_membership',
  'vehicle_registration',
  'government_id',
  'proof_of_address',
  'other'
);
CREATE TYPE "public"."DriverDocumentReviewStatus" AS ENUM ('submitted', 'approved', 'rejected');
CREATE TYPE "public"."DriverVerificationDecision" AS ENUM ('approved', 'rejected');
CREATE TYPE "public"."DriverRestrictionAction" AS ENUM ('restricted', 'reinstated');

CREATE TABLE "public"."DriverProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "todaId" TEXT,
  "operationalState" "public"."DriverOperationalState" NOT NULL DEFAULT 'pending_review',
  "verificationStatus" "public"."DriverVerificationStatus" NOT NULL DEFAULT 'pending',
  "restrictionStatus" "public"."DriverRestrictionStatus" NOT NULL DEFAULT 'unrestricted',
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "legalFullName" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "homeAddress" TEXT,
  "todaMembershipId" TEXT,
  "licenseNumber" TEXT,
  "licenseExpiry" TIMESTAMP(3),
  "vehicleType" TEXT,
  "plateNumber" TEXT,
  "vehicleModel" TEXT,
  "vehicleColor" TEXT,
  "verificationApprovedAt" TIMESTAMP(3),
  "lastVerificationReviewAt" TIMESTAMP(3),
  "restrictedAt" TIMESTAMP(3),
  "currentRestrictionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."DriverDocument" (
  "id" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "documentType" "public"."DriverDocumentType" NOT NULL,
  "fileUrl" TEXT,
  "storageRef" TEXT,
  "reviewStatus" "public"."DriverDocumentReviewStatus" NOT NULL DEFAULT 'submitted',
  "metadata" JSONB,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."DriverVerificationReview" (
  "id" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "decision" "public"."DriverVerificationDecision" NOT NULL,
  "reviewedByUserId" TEXT,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverVerificationReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."DriverRestrictionLog" (
  "id" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "action" "public"."DriverRestrictionAction" NOT NULL,
  "actedByUserId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverRestrictionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriverProfile_userId_key" ON "public"."DriverProfile"("userId");
CREATE INDEX "DriverProfile_tenantId_operationalState_idx" ON "public"."DriverProfile"("tenantId", "operationalState");
CREATE INDEX "DriverProfile_tenantId_verificationStatus_idx" ON "public"."DriverProfile"("tenantId", "verificationStatus");
CREATE INDEX "DriverProfile_tenantId_restrictionStatus_idx" ON "public"."DriverProfile"("tenantId", "restrictionStatus");
CREATE INDEX "DriverProfile_todaId_idx" ON "public"."DriverProfile"("todaId");

CREATE INDEX "DriverDocument_driverProfileId_reviewStatus_idx" ON "public"."DriverDocument"("driverProfileId", "reviewStatus");
CREATE INDEX "DriverDocument_documentType_idx" ON "public"."DriverDocument"("documentType");
CREATE INDEX "DriverDocument_reviewedByUserId_idx" ON "public"."DriverDocument"("reviewedByUserId");

CREATE INDEX "DriverVerificationReview_driverProfileId_createdAt_idx" ON "public"."DriverVerificationReview"("driverProfileId", "createdAt");
CREATE INDEX "DriverVerificationReview_reviewedByUserId_idx" ON "public"."DriverVerificationReview"("reviewedByUserId");

CREATE INDEX "DriverRestrictionLog_driverProfileId_createdAt_idx" ON "public"."DriverRestrictionLog"("driverProfileId", "createdAt");
CREATE INDEX "DriverRestrictionLog_actedByUserId_idx" ON "public"."DriverRestrictionLog"("actedByUserId");

ALTER TABLE "public"."DriverProfile"
  ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."DriverProfile"
  ADD CONSTRAINT "DriverProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."DriverProfile"
  ADD CONSTRAINT "DriverProfile_todaId_fkey" FOREIGN KEY ("todaId") REFERENCES "public"."TODATerminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."DriverDocument"
  ADD CONSTRAINT "DriverDocument_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "public"."DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."DriverDocument"
  ADD CONSTRAINT "DriverDocument_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."DriverVerificationReview"
  ADD CONSTRAINT "DriverVerificationReview_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "public"."DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."DriverVerificationReview"
  ADD CONSTRAINT "DriverVerificationReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."DriverRestrictionLog"
  ADD CONSTRAINT "DriverRestrictionLog_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "public"."DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."DriverRestrictionLog"
  ADD CONSTRAINT "DriverRestrictionLog_actedByUserId_fkey" FOREIGN KEY ("actedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "public"."DriverProfile" (
  "id",
  "userId",
  "tenantId",
  "operationalState",
  "verificationStatus",
  "restrictionStatus",
  "contactEmail",
  "contactPhone",
  "legalFullName",
  "restrictedAt",
  "currentRestrictionReason",
  "verificationApprovedAt",
  "lastVerificationReviewAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'driver-profile-' || u."id",
  u."id",
  u."tenantId",
  CASE
    WHEN COALESCE(u."isDriverRestricted", false) = true THEN 'restricted'::"public"."DriverOperationalState"
    WHEN COALESCE(u."isDriverVerified", false) = false THEN 'pending_review'::"public"."DriverOperationalState"
    ELSE 'offline'::"public"."DriverOperationalState"
  END,
  CASE
    WHEN COALESCE(u."isDriverVerified", false) = true THEN 'verified'::"public"."DriverVerificationStatus"
    ELSE 'pending'::"public"."DriverVerificationStatus"
  END,
  CASE
    WHEN COALESCE(u."isDriverRestricted", false) = true THEN 'restricted'::"public"."DriverRestrictionStatus"
    ELSE 'unrestricted'::"public"."DriverRestrictionStatus"
  END,
  u."email",
  COALESCE(u."phoneE164", u."phone"),
  u."name",
  u."driverRestrictedAt",
  u."driverRestrictionReason",
  CASE WHEN COALESCE(u."isDriverVerified", false) = true THEN u."updatedAt" ELSE NULL END,
  CASE WHEN COALESCE(u."isDriverVerified", false) = true THEN u."updatedAt" ELSE NULL END,
  u."createdAt",
  u."updatedAt"
FROM "public"."User" u
WHERE u."role" = 'driver'
  AND u."tenantId" IS NOT NULL
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "public"."DriverVerificationReview" (
  "id",
  "driverProfileId",
  "decision",
  "remarks",
  "createdAt"
)
SELECT
  'driver-verification-review-backfill-' || dp."id",
  dp."id",
  'approved'::"public"."DriverVerificationDecision",
  'Backfilled from legacy driver verification flag.',
  COALESCE(dp."verificationApprovedAt", dp."createdAt")
FROM "public"."DriverProfile" dp
WHERE dp."verificationStatus" = 'verified'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "public"."DriverRestrictionLog" (
  "id",
  "driverProfileId",
  "action",
  "reason",
  "createdAt"
)
SELECT
  'driver-restriction-log-backfill-' || dp."id",
  dp."id",
  'restricted'::"public"."DriverRestrictionAction",
  COALESCE(dp."currentRestrictionReason", 'Backfilled from legacy driver restriction flag.'),
  COALESCE(dp."restrictedAt", dp."updatedAt")
FROM "public"."DriverProfile" dp
WHERE dp."restrictionStatus" = 'restricted'
ON CONFLICT ("id") DO NOTHING;
