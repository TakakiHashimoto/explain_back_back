import { getSafeErrorMessage } from "../../../lib/getSafeErrorMsg.js";
import { prisma } from "../../../lib/prisma.js";

export async function finishReminder(
  reminderId: string,
  claimToken: string,
  onesignalId: string,
  now: Date,
) {
  const result = await prisma.reviewReminder.updateMany({
    where: { id: reminderId, claimToken, status: "PROCESSING" },
    data: {
      status: "SENT",
      onesignalId,
      sentAt: now,
      leaseExpiresAt: null,
      claimToken: null,
      lastError: null,
    },
  });

  return result.count === 1;
}

export async function markReminderFailed(
  reminderId: string,
  claimToken: string,
  error: unknown,
): Promise<boolean> {
  // Avoid writing API keys, credentials, or sensitive input to logs/database.
  const message = getSafeErrorMessage(error);
  const result = await prisma.reviewReminder.updateMany({
    where: { id: reminderId, status: "PROCESSING", claimToken },
    data: {
      status: "FAILED",
      leaseExpiresAt: null,
      claimToken: null,
      lastError: message.slice(0, 500),
    },
  });
  return result.count === 1;
}
