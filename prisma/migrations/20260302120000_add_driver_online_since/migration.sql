ALTER TABLE "DriverPresence"
ADD COLUMN IF NOT EXISTS "onlineSinceAt" TIMESTAMP(3);

UPDATE "DriverPresence"
SET "onlineSinceAt" = COALESCE("onlineSinceAt", "lastHeartbeatAt")
WHERE "isOnline" = true;

CREATE INDEX IF NOT EXISTS "DriverPresence_tenantId_isOnline_onlineSinceAt_idx"
ON "DriverPresence"("tenantId", "isOnline", "onlineSinceAt");
