ALTER TABLE "Ride"
ADD COLUMN IF NOT EXISTS "terminalId" TEXT;

CREATE INDEX IF NOT EXISTS "Ride_terminalId_idx" ON "Ride"("terminalId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Ride_terminalId_fkey'
  ) THEN
    ALTER TABLE "Ride"
    ADD CONSTRAINT "Ride_terminalId_fkey"
    FOREIGN KEY ("terminalId")
    REFERENCES "TODATerminal"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
