ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isDriverVerified" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "isDriverVerified" = true
WHERE "role" = 'driver';
