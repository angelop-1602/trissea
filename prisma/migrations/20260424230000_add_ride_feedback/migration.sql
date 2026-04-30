CREATE TABLE "RideFeedback" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RideFeedback_rideId_reviewerUserId_key" ON "RideFeedback"("rideId", "reviewerUserId");
CREATE INDEX "RideFeedback_reviewerUserId_createdAt_idx" ON "RideFeedback"("reviewerUserId", "createdAt");
CREATE INDEX "RideFeedback_subjectUserId_createdAt_idx" ON "RideFeedback"("subjectUserId", "createdAt");
CREATE INDEX "RideFeedback_rideId_idx" ON "RideFeedback"("rideId");

ALTER TABLE "RideFeedback"
ADD CONSTRAINT "RideFeedback_rideId_fkey"
FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RideFeedback"
ADD CONSTRAINT "RideFeedback_reviewerUserId_fkey"
FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RideFeedback"
ADD CONSTRAINT "RideFeedback_subjectUserId_fkey"
FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
