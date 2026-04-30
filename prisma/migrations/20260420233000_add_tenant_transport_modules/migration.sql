CREATE TYPE "public"."TransportModuleKey" AS ENUM ('tricycle', 'jeepney');

CREATE TABLE "public"."TenantTransportModule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "moduleKey" "public"."TransportModuleKey" NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "configJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantTransportModule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantTransportModule_tenantId_moduleKey_key" ON "public"."TenantTransportModule"("tenantId", "moduleKey");
CREATE INDEX "TenantTransportModule_tenantId_isEnabled_sortOrder_idx" ON "public"."TenantTransportModule"("tenantId", "isEnabled", "sortOrder");
CREATE INDEX "TenantTransportModule_tenantId_isDefault_idx" ON "public"."TenantTransportModule"("tenantId", "isDefault");

ALTER TABLE "public"."TenantTransportModule"
  ADD CONSTRAINT "TenantTransportModule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
