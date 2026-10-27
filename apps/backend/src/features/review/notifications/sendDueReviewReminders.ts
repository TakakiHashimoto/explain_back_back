import { claimReminder } from "./claimReminder.js";
import { createReminder } from "./createReminder.js";
import { finishReminder, markReminderFailed } from "./finishReminder.js";
import { getUsersWithDueReviews } from "./getUsersWithDueReviews.js";
import { sendReviewReminder } from "./sendReviewReminder.js";

// This is the orchestrator of the whole notification system
type SendFn = typeof sendReviewReminder;
export async function sendDueReviewReminders(
  now: Date,
  options: { dryRun?: boolean; send?: SendFn } = {},
) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("Invalid job timestamp");
  }

  const { dryRun = false, send = sendReviewReminder } = options;
  const users = await getUsersWithDueReviews(now);
  const summary = {
    eligible: users.length,
    accepted: 0,
    skipped: 0,
    failed: 0,
  };

  for (const user of users) {
    if (dryRun) {
      console.info("[DRY RUN] Would send reminder", {
        userId: user.userId,
        dueCount: user.dueCount,
      });

      summary.skipped++;
      continue;
    }
    try {
      // This returns {reminderId, reminderDate, } etc
      const reminder = await createReminder(user.userId, user.dueCount, now);
      // This one is to lock in the operation
      const token = await claimReminder(reminder.id, new Date());

      if (!token) {
        summary.skipped++;
        continue;
      }

      try {
        const onesignalId = await send(
          reminder.userId,
          reminder.dueCount,
          reminder.idempotencyKey,
        );

        // mark it as "SENT"
        const updated = await finishReminder(
          reminder.id,
          token,
          onesignalId,
          new Date(),
        );
        if (!updated) {
          // Another worker reclaimed the lease; this worker lost ownership.
          throw new Error("Reminder claim lost before marking SENT");
        }
        summary.accepted++;
      } catch (e) {
        const safeMessage = getSafeErrorMessage(e);
        const marked = await markReminderFailed(
          reminder.id,
          token,
          safeMessage,
        );
        if (!marked) {
          console.error(
            "Unable to mark failure; claim no longer owned",
            reminder.id,
          );
        }
        summary.failed++;
        console.error("Reminder processing failed", {
          reminderId: reminder.id,
          reason: safeMessage,
        });
      }
    } catch (e) {
      summary.failed++;
      console.error("Reminder setup/claim failed", user.userId, e);
    }
  }

  return summary;
}
function getSafeErrorMessage(error: any) {
  throw new Error("Function not implemented.");
}
