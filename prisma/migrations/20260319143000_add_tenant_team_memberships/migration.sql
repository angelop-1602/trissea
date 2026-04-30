-- CreateEnum
CREATE TYPE "TenantRoleScope" AS ENUM ('tenant');

-- CreateTable
CREATE TABLE "TenantRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "TenantRoleScope" NOT NULL DEFAULT 'tenant',
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantRolePermission" (
    "id" TEXT NOT NULL,
    "tenantRoleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantRoleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedByUserId" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantRole_key_key" ON "TenantRole"("key");

-- CreateIndex
CREATE INDEX "TenantRole_tenantId_idx" ON "TenantRole"("tenantId");

-- CreateIndex
CREATE INDEX "TenantRole_scope_idx" ON "TenantRole"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "TenantRolePermission_tenantRoleId_permissionKey_key" ON "TenantRolePermission"("tenantRoleId", "permissionKey");

-- CreateIndex
CREATE INDEX "TenantRolePermission_permissionKey_idx" ON "TenantRolePermission"("permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMembership_userId_tenantId_key" ON "TenantMembership"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "TenantMembership_tenantId_isActive_idx" ON "TenantMembership"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "TenantMembership_tenantRoleId_idx" ON "TenantMembership"("tenantRoleId");

-- CreateIndex
CREATE INDEX "TenantMembership_invitedByUserId_idx" ON "TenantMembership"("invitedByUserId");

-- AddForeignKey
ALTER TABLE "TenantRole" ADD CONSTRAINT "TenantRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_tenantRoleId_fkey" FOREIGN KEY ("tenantRoleId") REFERENCES "TenantRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantRoleId_fkey" FOREIGN KEY ("tenantRoleId") REFERENCES "TenantRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default tenant roles
INSERT INTO "TenantRole" ("id", "tenantId", "key", "name", "description", "scope", "isSystem", "createdAt", "updatedAt")
VALUES
  ('tenant-role-tenant-owner', NULL, 'tenant_owner', 'Tenant Owner', 'Full tenant control, including tenant team management.', 'tenant', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tenant-role-tenant-admin', NULL, 'tenant_admin', 'Tenant Admin', 'Daily tenant operator with team management access.', 'tenant', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tenant-role-dispatcher', NULL, 'dispatcher', 'Dispatcher', 'Dispatch-focused tenant staff role.', 'tenant', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tenant-role-driver-reviewer', NULL, 'driver_reviewer', 'Driver Reviewer', 'Tenant staff role focused on driver review workflows.', 'tenant', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tenant-role-reports-viewer', NULL, 'reports_viewer', 'Reports Viewer', 'Read-only reporting role for tenant staff.', 'tenant', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "tenantId" = EXCLUDED."tenantId",
  "scope" = EXCLUDED."scope",
  "isSystem" = EXCLUDED."isSystem",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Seed default tenant role permissions
INSERT INTO "TenantRolePermission" ("id", "tenantRoleId", "permissionKey", "createdAt")
VALUES
  ('tenant-role-tenant-owner::tenant.team.view', 'tenant-role-tenant-owner', 'tenant.team.view', CURRENT_TIMESTAMP),
  ('tenant-role-tenant-owner::tenant.team.invite', 'tenant-role-tenant-owner', 'tenant.team.invite', CURRENT_TIMESTAMP),
  ('tenant-role-tenant-owner::tenant.team.roles.manage', 'tenant-role-tenant-owner', 'tenant.team.roles.manage', CURRENT_TIMESTAMP),
  ('tenant-role-tenant-owner::tenant.team.members.manage_status', 'tenant-role-tenant-owner', 'tenant.team.members.manage_status', CURRENT_TIMESTAMP),
  ('tenant-role-tenant-admin::tenant.team.view', 'tenant-role-tenant-admin', 'tenant.team.view', CURRENT_TIMESTAMP),
  ('tenant-role-tenant-admin::tenant.team.invite', 'tenant-role-tenant-admin', 'tenant.team.invite', CURRENT_TIMESTAMP),
  ('tenant-role-tenant-admin::tenant.team.roles.manage', 'tenant-role-tenant-admin', 'tenant.team.roles.manage', CURRENT_TIMESTAMP),
  ('tenant-role-tenant-admin::tenant.team.members.manage_status', 'tenant-role-tenant-admin', 'tenant.team.members.manage_status', CURRENT_TIMESTAMP)
ON CONFLICT ("tenantRoleId", "permissionKey") DO NOTHING;

-- Backfill memberships for existing tenant admins without touching current login flow
INSERT INTO "TenantMembership" ("id", "userId", "tenantId", "tenantRoleId", "isActive", "invitedByUserId", "deactivatedAt", "createdAt", "updatedAt")
SELECT
  'tenant-membership-' || "id" || '-' || "tenantId" AS "id",
  "id" AS "userId",
  "tenantId",
  CASE
    WHEN ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt" ASC, "id" ASC) = 1
      THEN 'tenant-role-tenant-owner'
    ELSE 'tenant-role-tenant-admin'
  END AS "tenantRoleId",
  true AS "isActive",
  NULL AS "invitedByUserId",
  NULL AS "deactivatedAt",
  CURRENT_TIMESTAMP AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "User"
WHERE "role" = 'admin'
  AND "tenantId" IS NOT NULL
ON CONFLICT ("userId", "tenantId") DO NOTHING;
