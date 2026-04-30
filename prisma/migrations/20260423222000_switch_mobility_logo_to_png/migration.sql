ALTER TABLE "Tenant" ALTER COLUMN "logo" SET DEFAULT '/mobility-logo.png';
ALTER TABLE "Tenant" ALTER COLUMN "logoUrl" SET DEFAULT '/mobility-logo.png';

UPDATE "Tenant"
SET "logo" = '/mobility-logo.png'
WHERE "logo" IN ('/mobility-logo.svg', '/mobility-logo.png');

UPDATE "Tenant"
SET "logoUrl" = '/mobility-logo.png'
WHERE "logoUrl" IN ('/mobility-logo.svg', '/mobility-logo.png');

UPDATE "TenantSettings"
SET "branding" = jsonb_set("branding"::jsonb, '{logoUrl}', to_jsonb('/mobility-logo.png'::text), true)
WHERE "branding" IS NOT NULL
  AND COALESCE("branding"->>'logoUrl', '') IN ('/mobility-logo.svg', '/mobility-logo.png');
