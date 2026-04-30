-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branding" JSONB NOT NULL,
    "moduleVisibility" JSONB NOT NULL,
    "operationsPreferences" JSONB NOT NULL,
    "reportingPreferences" JSONB NOT NULL,
    "uiPreferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill default settings for existing tenants using current tenant branding fields
INSERT INTO "TenantSettings" (
  "id",
  "tenantId",
  "branding",
  "moduleVisibility",
  "operationsPreferences",
  "reportingPreferences",
  "uiPreferences",
  "createdAt",
  "updatedAt"
)
SELECT
  'tenant-settings-' || t."id" AS "id",
  t."id" AS "tenantId",
  jsonb_build_object(
    'displayName', t."name",
    'logoUrl', COALESCE(NULLIF(t."logoUrl", ''), NULLIF(t."logo", ''), '/mobility-logo.png'),
    'primaryColor', COALESCE(t."primaryColor", '#F59E0B'),
    'accentColor', COALESCE(t."accentColor", '#1D4ED8')
  ) AS "branding",
  jsonb_build_object(
    'reportsVisible', true,
    'tenantTeamVisible', true,
    'dashboardWidgets', jsonb_build_object(
      'liveTripQueue', true,
      'queueWatch', true,
      'onlineDrivers', true,
      'operationalSummary', true
    ),
    'settingsSections', jsonb_build_object(
      'branding', true,
      'operations', true,
      'reporting', true,
      'ui', true
    )
  ) AS "moduleVisibility",
  jsonb_build_object(
    'driversDefaultTab', 'verified',
    'reservationsDefaultTab', 'active',
    'tripsDefaultTab', 'active'
  ) AS "operationsPreferences",
  jsonb_build_object(
    'showCompletionRate', true,
    'showDriverActivity', true,
    'showTerminalOccupancy', true
  ) AS "reportingPreferences",
  jsonb_build_object(
    'denseTables', false,
    'showKpiStrip', true
  ) AS "uiPreferences",
  CURRENT_TIMESTAMP AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "Tenant" t
ON CONFLICT ("tenantId") DO NOTHING;

-- Grant settings permissions to owner/admin roles
INSERT INTO "TenantRolePermission" ("id", "tenantRoleId", "permissionKey", "createdAt")
VALUES
  ('tenant-role-tenant-owner::tenant.settings.view', 'tenant-role-tenant-owner', 'tenant.settings.view', CURRENT_TIMESTAMP),
  ('tenant-role-tenant-owner::tenant.settings.manage', 'tenant-role-tenant-owner', 'tenant.settings.manage', CURRENT_TIMESTAMP),
  ('tenant-role-tenant-admin::tenant.settings.view', 'tenant-role-tenant-admin', 'tenant.settings.view', CURRENT_TIMESTAMP),
  ('tenant-role-tenant-admin::tenant.settings.manage', 'tenant-role-tenant-admin', 'tenant.settings.manage', CURRENT_TIMESTAMP)
ON CONFLICT ("tenantRoleId", "permissionKey") DO NOTHING;
