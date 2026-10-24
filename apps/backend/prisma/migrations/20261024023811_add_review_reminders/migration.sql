-- CreateEnum
CREATE TYPE "ReviewReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "ReviewReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderDate" DATE NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "dueCount" INTEGER NOT NULL,
    "status" "ReviewReminderStatus" NOT NULL DEFAULT 'PENDING',
    "claimToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "onesignalId" TEXT,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReminder_idempotencyKey_key" ON "ReviewReminder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ReviewReminder_status_leaseExpiresAt_idx" ON "ReviewReminder"("status", "leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReminder_userId_reminderDate_key" ON "ReviewReminder"("userId", "reminderDate");

-- AddForeignKey
ALTER TABLE "ReviewReminder" ADD CONSTRAINT "ReviewReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
