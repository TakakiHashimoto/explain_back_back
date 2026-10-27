// This function is for locking one worker and prevent more than 2 workers sending same notifications

import { prisma } from "../../../lib/prisma.js";

const LEASE_MS = 2 * 60 * 1000; // 2 mins
const RETRY_DELAY_MS = 30 * 60 * 1000; // 30mins
const MAX_ATTEMPTS = 3;

export async function claimReminder(reminderId: string, now: Date) {
  if (!reminderId.trim()) {
    throw new Error("Reminder ID is missing");
  }

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("Invalid claim time");
  }

  const claimToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
  const retryBefore = new Date(now.getTime() - RETRY_DELAY_MS);

  const result = await prisma.reviewReminder.updateMany({
    where: {
      id: reminderId,
      attempts: { lt: MAX_ATTEMPTS },
      OR: [
        { status: "PENDING" },
        { status: "FAILED", updatedAt: { lte: retryBefore } },
        { status: "PROCESSING", leaseExpiresAt: { lt: now } },
      ],
    },
    data: {
      status: "PROCESSING",
      claimToken,
      leaseExpiresAt,
      attempts: { increment: 1 },
      lastError: null,
    },
  });

  // count=1: this worker claimed the record. count=0: skip.
  return result.count === 1 ? claimToken : null;
}
