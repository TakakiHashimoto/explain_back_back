/*
  Warnings:

  - You are about to drop the column `active` on the `Entitlement` table. All the data in the column will be lost.
  - Changed the type of `kind` on the `UsageRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UsageKind" AS ENUM ('ANALYSIS', 'REVIEW');

-- AlterTable
ALTER TABLE "Entitlement" DROP COLUMN "active";

-- AlterTable
ALTER TABLE "UsageRecord" DROP COLUMN "kind",
ADD COLUMN     "kind" "UsageKind" NOT NULL;

-- DropEnum
DROP TYPE "Kind";

-- CreateIndex
CREATE INDEX "UsageRecord_userId_kind_createdAt_idx" ON "UsageRecord"("userId", "kind", "createdAt");
