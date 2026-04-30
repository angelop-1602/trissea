CREATE TABLE "public"."TenantAuditLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."SupportAccessLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "superAdminUserId" TEXT NOT NULL,
  "accessType" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TenantAuditLog_tenantId_createdAt_idx" ON "public"."TenantAuditLog"("tenantId", "createdAt");
CREATE INDEX "TenantAuditLog_tenantId_module_createdAt_idx" ON "public"."TenantAuditLog"("tenantId", "module", "createdAt");
CREATE INDEX "TenantAuditLog_actorUserId_idx" ON "public"."TenantAuditLog"("actorUserId");

CREATE INDEX "SupportAccessLog_tenantId_createdAt_idx" ON "public"."SupportAccessLog"("tenantId", "createdAt");
CREATE INDEX "SupportAccessLog_superAdminUserId_createdAt_idx" ON "public"."SupportAccessLog"("superAdminUserId", "createdAt");

ALTER TABLE "public"."TenantAuditLog"
  ADD CONSTRAINT "TenantAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."TenantAuditLog"
  ADD CONSTRAINT "TenantAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."SupportAccessLog"
  ADD CONSTRAINT "SupportAccessLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."SupportAccessLog"
  ADD CONSTRAINT "SupportAccessLog_superAdminUserId_fkey" FOREIGN KEY ("superAdminUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "public"."TenantRolePermission" ("id", "tenantRoleId", "permissionKey", "createdAt")
VALUES
  ('tenant-role-tenant-owner::tenant.audit.view', 'tenant-role-tenant-owner', 'tenant.audit.view', CURRENT_TIMESTAMP),
  ('tenant-role-tenant-admin::tenant.audit.view', 'tenant-role-tenant-admin', 'tenant.audit.view', CURRENT_TIMESTAMP),
  ('tenant-role-reports-viewer::tenant.audit.view', 'tenant-role-reports-viewer', 'tenant.audit.view', CURRENT_TIMESTAMP)
ON CONFLICT ("tenantRoleId", "permissionKey") DO NOTHING;
