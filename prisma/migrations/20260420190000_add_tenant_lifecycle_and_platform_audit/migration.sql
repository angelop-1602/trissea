CREATE TYPE "public"."TenantStatus" AS ENUM ('active', 'suspended');

ALTER TABLE "public"."Tenant"
  ADD COLUMN "status" "public"."TenantStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspensionReason" TEXT;

CREATE TABLE "public"."PlatformAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "tenantId" TEXT,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "reason" TEXT NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformAuditLog_actorUserId_createdAt_idx" ON "public"."PlatformAuditLog"("actorUserId", "createdAt");
CREATE INDEX "PlatformAuditLog_tenantId_createdAt_idx" ON "public"."PlatformAuditLog"("tenantId", "createdAt");
CREATE INDEX "PlatformAuditLog_module_createdAt_idx" ON "public"."PlatformAuditLog"("module", "createdAt");

ALTER TABLE "public"."PlatformAuditLog"
  ADD CONSTRAINT "PlatformAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."PlatformAuditLog"
  ADD CONSTRAINT "PlatformAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
