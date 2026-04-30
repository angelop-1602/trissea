-- Add canonical E.164 phone field used for identity mapping.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneE164" TEXT;

-- Audit table for one-time identity merge operations.
CREATE TABLE IF NOT EXISTS "UserIdentityMergeLog" (
  "id" BIGSERIAL PRIMARY KEY,
  "canonicalUserId" TEXT NOT NULL,
  "mergedUserId" TEXT NOT NULL,
  "canonicalPhoneE164" TEXT NOT NULL,
  "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backfill canonical phone values from existing "phone".
UPDATE "User"
SET "phoneE164" = CASE
  WHEN regexp_replace("phone", '\D', '', 'g') LIKE '63%' THEN '+' || regexp_replace("phone", '\D', '', 'g')
  WHEN regexp_replace("phone", '\D', '', 'g') LIKE '0__________' THEN '+63' || substring(regexp_replace("phone", '\D', '', 'g') FROM 2)
  ELSE '+' || regexp_replace("phone", '\D', '', 'g')
END
WHERE "phoneE164" IS NULL OR "phoneE164" = '';

-- Merge duplicate users that normalize to the same "phoneE164".
DO $$
DECLARE
  duplicate_phone TEXT;
  canonical_id TEXT;
  merged_record RECORD;
  source_supabase_id TEXT;
BEGIN
  FOR duplicate_phone IN
    SELECT "phoneE164"
    FROM "User"
    WHERE "phoneE164" IS NOT NULL AND "phoneE164" <> ''
    GROUP BY "phoneE164"
    HAVING COUNT(*) > 1
  LOOP
    SELECT u."id"
    INTO canonical_id
    FROM "User" u
    WHERE u."phoneE164" = duplicate_phone
    ORDER BY
      CASE u."role"
        WHEN 'superadmin' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'driver' THEN 2
        ELSE 1
      END DESC,
      u."createdAt" ASC
    LIMIT 1;

    FOR merged_record IN
      SELECT u."id"
      FROM "User" u
      WHERE u."phoneE164" = duplicate_phone
        AND u."id" <> canonical_id
    LOOP
      INSERT INTO "UserIdentityMergeLog" ("canonicalUserId", "mergedUserId", "canonicalPhoneE164")
      VALUES (canonical_id, merged_record."id", duplicate_phone);

      UPDATE "Ride"
      SET "passengerId" = canonical_id
      WHERE "passengerId" = merged_record."id";

      UPDATE "Ride"
      SET "driverId" = canonical_id
      WHERE "driverId" = merged_record."id";

      UPDATE "Reservation"
      SET "passengerId" = canonical_id
      WHERE "passengerId" = merged_record."id";

      UPDATE "DriverOffer"
      SET "driverId" = canonical_id
      WHERE "driverId" = merged_record."id";

      IF EXISTS (SELECT 1 FROM "DriverPresence" WHERE "driverId" = merged_record."id") THEN
        IF EXISTS (SELECT 1 FROM "DriverPresence" WHERE "driverId" = canonical_id) THEN
          DELETE FROM "DriverPresence" WHERE "driverId" = merged_record."id";
        ELSE
          UPDATE "DriverPresence"
          SET
            "driverId" = canonical_id,
            "tenantId" = (SELECT "tenantId" FROM "User" WHERE "id" = canonical_id),
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "driverId" = merged_record."id";
        END IF;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM "User"
        WHERE "id" = canonical_id
          AND "supabaseId" IS NULL
      ) THEN
        SELECT "supabaseId"
        INTO source_supabase_id
        FROM "User"
        WHERE "id" = merged_record."id";

        IF source_supabase_id IS NOT NULL THEN
          UPDATE "User"
          SET
            "supabaseId" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = merged_record."id";

          UPDATE "User"
          SET
            "supabaseId" = source_supabase_id,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = canonical_id;
        END IF;
      END IF;

      DELETE FROM "User"
      WHERE "id" = merged_record."id";
    END LOOP;
  END LOOP;
END $$;

-- Ensure all rows now have canonical phone value.
UPDATE "User"
SET "phoneE164" = CASE
  WHEN regexp_replace("phone", '\D', '', 'g') LIKE '63%' THEN '+' || regexp_replace("phone", '\D', '', 'g')
  WHEN regexp_replace("phone", '\D', '', 'g') LIKE '0__________' THEN '+63' || substring(regexp_replace("phone", '\D', '', 'g') FROM 2)
  ELSE '+' || regexp_replace("phone", '\D', '', 'g')
END
WHERE "phoneE164" IS NULL OR "phoneE164" = '';

ALTER TABLE "User" ALTER COLUMN "phoneE164" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'User_phoneE164_key'
  ) THEN
    CREATE UNIQUE INDEX "User_phoneE164_key" ON "User"("phoneE164");
  END IF;
END $$;
