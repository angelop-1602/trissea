-- CreateTable
CREATE TABLE "DriverPresence" (
    "driverId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverPresence_pkey" PRIMARY KEY ("driverId")
);

-- CreateIndex
CREATE INDEX "DriverPresence_tenantId_isOnline_lastHeartbeatAt_idx" ON "DriverPresence"("tenantId", "isOnline", "lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "DriverPresence_latitude_longitude_idx" ON "DriverPresence"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "DriverPresence" ADD CONSTRAINT "DriverPresence_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPresence" ADD CONSTRAINT "DriverPresence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
