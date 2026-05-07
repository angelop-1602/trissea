DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typnamespace = 'public'::regnamespace
          AND typname = 'P2PDepartureStatus'
    ) THEN
        CREATE TYPE "public"."P2PDepartureStatus" AS ENUM ('scheduled', 'boarding', 'departed', 'completed', 'cancelled');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typnamespace = 'public'::regnamespace
          AND typname = 'P2PReservationStatus'
    ) THEN
        CREATE TYPE "public"."P2PReservationStatus" AS ENUM ('confirmed', 'boarded', 'completed', 'cancelled', 'no_show');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."P2PModuleCorridor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "originLabel" TEXT NOT NULL,
    "originLatitude" DOUBLE PRECISION NOT NULL,
    "originLongitude" DOUBLE PRECISION NOT NULL,
    "destinationLabel" TEXT NOT NULL,
    "destinationLatitude" DOUBLE PRECISION NOT NULL,
    "destinationLongitude" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "estimatedDuration" INTEGER NOT NULL,
    "baseFare" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "P2PModuleCorridor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."P2PModuleDeparture" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "corridorId" TEXT NOT NULL,
    "driverId" TEXT,
    "vehicleLabel" TEXT,
    "boardingBay" TEXT NOT NULL,
    "seatCapacity" INTEGER NOT NULL,
    "availableSeats" INTEGER NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "status" "public"."P2PDepartureStatus" NOT NULL DEFAULT 'scheduled',
    "boardingStartedAt" TIMESTAMP(3),
    "departedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "P2PModuleDeparture_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."P2PModuleReservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departureId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "seatCount" INTEGER NOT NULL DEFAULT 1,
    "fareTotal" DOUBLE PRECISION NOT NULL,
    "bookingReference" TEXT NOT NULL,
    "status" "public"."P2PReservationStatus" NOT NULL DEFAULT 'confirmed',
    "boardedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "P2PModuleReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "P2PModuleCorridor_tenantId_code_key" ON "public"."P2PModuleCorridor"("tenantId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "P2PModuleReservation_departureId_passengerId_key" ON "public"."P2PModuleReservation"("departureId", "passengerId");
CREATE INDEX IF NOT EXISTS "P2PModuleCorridor_tenantId_isActive_createdAt_idx" ON "public"."P2PModuleCorridor"("tenantId", "isActive", "createdAt");
CREATE INDEX IF NOT EXISTS "P2PModuleDeparture_tenantId_status_departureTime_idx" ON "public"."P2PModuleDeparture"("tenantId", "status", "departureTime");
CREATE INDEX IF NOT EXISTS "P2PModuleDeparture_driverId_status_departureTime_idx" ON "public"."P2PModuleDeparture"("driverId", "status", "departureTime");
CREATE INDEX IF NOT EXISTS "P2PModuleDeparture_corridorId_departureTime_idx" ON "public"."P2PModuleDeparture"("corridorId", "departureTime");
CREATE INDEX IF NOT EXISTS "P2PModuleReservation_tenantId_status_createdAt_idx" ON "public"."P2PModuleReservation"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "P2PModuleReservation_departureId_status_idx" ON "public"."P2PModuleReservation"("departureId", "status");
CREATE INDEX IF NOT EXISTS "P2PModuleReservation_passengerId_status_createdAt_idx" ON "public"."P2PModuleReservation"("passengerId", "status", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'P2PModuleCorridor_tenantId_fkey'
    ) THEN
        ALTER TABLE "public"."P2PModuleCorridor"
            ADD CONSTRAINT "P2PModuleCorridor_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'P2PModuleDeparture_tenantId_fkey'
    ) THEN
        ALTER TABLE "public"."P2PModuleDeparture"
            ADD CONSTRAINT "P2PModuleDeparture_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'P2PModuleDeparture_corridorId_fkey'
    ) THEN
        ALTER TABLE "public"."P2PModuleDeparture"
            ADD CONSTRAINT "P2PModuleDeparture_corridorId_fkey"
            FOREIGN KEY ("corridorId") REFERENCES "public"."P2PModuleCorridor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'P2PModuleDeparture_driverId_fkey'
    ) THEN
        ALTER TABLE "public"."P2PModuleDeparture"
            ADD CONSTRAINT "P2PModuleDeparture_driverId_fkey"
            FOREIGN KEY ("driverId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'P2PModuleReservation_tenantId_fkey'
    ) THEN
        ALTER TABLE "public"."P2PModuleReservation"
            ADD CONSTRAINT "P2PModuleReservation_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'P2PModuleReservation_departureId_fkey'
    ) THEN
        ALTER TABLE "public"."P2PModuleReservation"
            ADD CONSTRAINT "P2PModuleReservation_departureId_fkey"
            FOREIGN KEY ("departureId") REFERENCES "public"."P2PModuleDeparture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'P2PModuleReservation_passengerId_fkey'
    ) THEN
        ALTER TABLE "public"."P2PModuleReservation"
            ADD CONSTRAINT "P2PModuleReservation_passengerId_fkey"
            FOREIGN KEY ("passengerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
