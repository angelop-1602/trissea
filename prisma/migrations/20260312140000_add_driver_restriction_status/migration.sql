ALTER TABLE "User"
ADD COLUMN "isDriverRestricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "driverRestrictionReason" TEXT,
ADD COLUMN "driverRestrictedAt" TIMESTAMP(3);
