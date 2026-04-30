DO $$
BEGIN
  CREATE TYPE "TenantPSGCType" AS ENUM ('province', 'city_municipality');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "psgcCode" TEXT,
  ADD COLUMN IF NOT EXISTS "psgcType" "TenantPSGCType" DEFAULT 'province',
  ADD COLUMN IF NOT EXISTS "provinceCode" TEXT,
  ADD COLUMN IF NOT EXISTS "regionCode" TEXT,
  ADD COLUMN IF NOT EXISTS "regionName" TEXT;

UPDATE "Tenant"
SET
  "logo" = '/mobility-logo.png'
WHERE "logo" IS NULL OR btrim("logo") = '';

UPDATE "Tenant" t
SET
  "regionCode" = COALESCE(t."regionCode", r."id"),
  "regionName" = COALESCE(t."regionName", r."name"),
  "provinceCode" = COALESCE(t."provinceCode", t."id"),
  "psgcCode" = COALESCE(t."psgcCode", t."id"),
  "psgcType" = COALESCE(t."psgcType", 'province'::"TenantPSGCType")
FROM "Region" r
WHERE t."regionId" = r."id";

UPDATE "Tenant"
SET
  "regionCode" = COALESCE("regionCode", 'unknown'),
  "regionName" = COALESCE("regionName", 'Unknown Region'),
  "provinceCode" = COALESCE("provinceCode", "id"),
  "psgcCode" = COALESCE("psgcCode", "id"),
  "psgcType" = COALESCE("psgcType", 'province'::"TenantPSGCType"),
  "logo" = COALESCE(NULLIF("logo", ''), '/mobility-logo.png');

ALTER TABLE "Tenant" ALTER COLUMN "logo" SET DEFAULT '/mobility-logo.png';
ALTER TABLE "Tenant" ALTER COLUMN "logo" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "psgcCode" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "psgcType" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "provinceCode" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "regionCode" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "regionName" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_psgcCode_key" ON "Tenant"("psgcCode");
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_provinceCode_key" ON "Tenant"("provinceCode");
CREATE INDEX IF NOT EXISTS "Tenant_regionCode_idx" ON "Tenant"("regionCode");

ALTER TABLE "User" ALTER COLUMN "tenantId" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "phoneE164" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustResetPassword" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "tenantId" = NULL
WHERE "role" IN ('passenger', 'superadmin');

ALTER TABLE "Tenant" DROP CONSTRAINT IF EXISTS "Tenant_regionId_fkey";
DROP INDEX IF EXISTS "Tenant_regionId_idx";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "regionId";

DROP TABLE IF EXISTS "Region";
