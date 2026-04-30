ALTER TABLE "Tenant" ALTER COLUMN "logo" SET DEFAULT '/mobility-logo.svg';
ALTER TABLE "Tenant" ALTER COLUMN "logoUrl" SET DEFAULT '/mobility-logo.svg';

UPDATE "Tenant"
SET "logo" = '/mobility-logo.svg'
WHERE "logo" = '/mobility-logo.png';

UPDATE "Tenant"
SET "logoUrl" = '/mobility-logo.svg'
WHERE "logoUrl" = '/mobility-logo.png';

UPDATE "TenantSettings"
SET "branding" = jsonb_set("branding"::jsonb, '{logoUrl}', to_jsonb('/mobility-logo.svg'::text), true)
WHERE COALESCE("branding"::jsonb ->> 'logoUrl', '') = '/mobility-logo.png';
