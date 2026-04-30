ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "faviconUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "backgroundColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "foregroundColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "driverPrimaryColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "driverAccentColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "driverBackgroundColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "driverForegroundColor" TEXT;

ALTER TABLE "Tenant" ALTER COLUMN "logo" SET DEFAULT '/trissea-logo.png';
ALTER TABLE "Tenant" ALTER COLUMN "logoUrl" SET DEFAULT '/trissea-logo.png';

UPDATE "Tenant"
SET "logo" = '/trissea-logo.png'
WHERE "logo" IN ('/mobility-logo.png', '/mobility-logo.svg', '/mobilit-logo-colored.png', '/mobilit-logo-white.png');

UPDATE "Tenant"
SET "logoUrl" = '/trissea-logo.png'
WHERE "logoUrl" IN ('/mobility-logo.png', '/mobility-logo.svg', '/mobilit-logo-colored.png', '/mobilit-logo-white.png');

UPDATE "Tenant"
SET "primaryColor" = '#14622e'
WHERE "primaryColor" IS NULL OR lower("primaryColor") IN ('#0f766e', '#0369a1');

UPDATE "Tenant"
SET "accentColor" = '#fecc04'
WHERE "accentColor" IS NULL OR lower("accentColor") IN ('#0369a1', '#f59e0b', '#1d4ed8');

UPDATE "Tenant"
SET
  "backgroundColor" = COALESCE("backgroundColor", '#f5f9f7'),
  "foregroundColor" = COALESCE("foregroundColor", '#0f1f16');

UPDATE "TenantSettings"
SET "branding" = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            "branding"::jsonb,
            '{logoUrl}',
            to_jsonb(
              CASE
                WHEN COALESCE("branding"::jsonb ->> 'logoUrl', '') IN ('', '/mobility-logo.png', '/mobility-logo.svg', '/mobilit-logo-colored.png', '/mobilit-logo-white.png')
                THEN '/trissea-logo.png'
                ELSE "branding"::jsonb ->> 'logoUrl'
              END
            ),
            true
          ),
          '{primaryColor}',
          to_jsonb(
            CASE
              WHEN lower(COALESCE("branding"::jsonb ->> 'primaryColor', '')) IN ('#0f766e', '#0369a1', '')
              THEN '#14622e'
              ELSE "branding"::jsonb ->> 'primaryColor'
            END
          ),
          true
        ),
        '{accentColor}',
        to_jsonb(
          CASE
            WHEN lower(COALESCE("branding"::jsonb ->> 'accentColor', '')) IN ('#0369a1', '#f59e0b', '#1d4ed8', '')
            THEN '#fecc04'
            ELSE "branding"::jsonb ->> 'accentColor'
          END
        ),
        true
      ),
      '{backgroundColor}',
      to_jsonb(COALESCE("branding"::jsonb ->> 'backgroundColor', '#f5f9f7')),
      true
    ),
    '{foregroundColor}',
    to_jsonb(COALESCE("branding"::jsonb ->> 'foregroundColor', '#0f1f16')),
    true
  ),
  '{faviconUrl}',
  to_jsonb(COALESCE("branding"::jsonb ->> 'faviconUrl', '/trissea-icon-32.png')),
  true
)
WHERE "branding" IS NOT NULL;
