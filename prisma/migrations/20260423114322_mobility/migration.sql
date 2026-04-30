/*
  Warnings:

  - You are about to drop the `UserIdentityMergeLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "DriverDocument" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DriverProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TenantRole" ALTER COLUMN "isSystem" SET DEFAULT false;

-- DropTable
DROP TABLE "UserIdentityMergeLog";

-- CreateIndex
CREATE INDEX "User_phoneE164_idx" ON "User"("phoneE164");
