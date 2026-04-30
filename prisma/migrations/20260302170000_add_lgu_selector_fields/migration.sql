DO $$
BEGIN
  CREATE TYPE "TenantLGUType" AS ENUM ('province', 'city', 'municipality');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "lguCode" TEXT,
  ADD COLUMN IF NOT EXISTS "lguName" TEXT,
  ADD COLUMN IF NOT EXISTS "lguType" "TenantLGUType",
  ADD COLUMN IF NOT EXISTS "provinceName" TEXT,
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT DEFAULT '/mobility-logo.png';

UPDATE "Tenant"
SET
  "lguCode" = COALESCE("lguCode", "psgcCode", "id"),
  "lguName" = COALESCE("lguName", "name"),
  "lguType" = COALESCE(
    "lguType",
    CASE
      WHEN "psgcType" = 'province' THEN 'province'::"TenantLGUType"
      WHEN LOWER("name") LIKE '%city%' THEN 'city'::"TenantLGUType"
      ELSE 'municipality'::"TenantLGUType"
    END
  ),
  "logoUrl" = COALESCE(NULLIF("logoUrl", ''), NULLIF("logo", ''), '/mobility-logo.png');

ALTER TABLE "Tenant" ALTER COLUMN "lguCode" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "lguName" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "lguType" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "logoUrl" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "logoUrl" SET DEFAULT '/mobility-logo.png';

ALTER TABLE "Tenant" ALTER COLUMN "regionCode" DROP NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "regionName" DROP NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "provinceCode" DROP NOT NULL;

DROP INDEX IF EXISTS "Tenant_provinceCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_lguCode_key" ON "Tenant"("lguCode");
CREATE INDEX IF NOT EXISTS "Tenant_provinceCode_idx" ON "Tenant"("provinceCode");
