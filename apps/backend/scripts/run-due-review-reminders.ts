import "dotenv/config";
import type { sendDueReviewReminders } from "../src/features/review/notifications/sendDueReviewReminders.js";
import { getSafeErrorMessage } from "../src/lib/getSafeErrorMsg.js";

// Inject only the job boundaries so the CLI's window and error handling can be tested.
export async function runReminderJob(
  dependencies: {
    run: typeof sendDueReviewReminders;
    disconnect: () => Promise<void>;
  },
  { now = new Date(), env = process.env }: {
    now?: Date;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<number> {
  let exitCode = 0;
  try {
    const dryRun = env.NOTIFICATION_DRY_RUN === "true" ||
      (env.GITHUB_ACTIONS === "true" && env.NOTIFICATION_DRY_RUN !== "false");

    // Only dry-run may bypass the daily 16:00 UTC sending window.
    if (!dryRun && now.getUTCHours() < 16) {
      console.log("Before daily UTC reminder window; skipping");
    } else {
      const summary = await dependencies.run(now, { dryRun });
      console.log("Reminder job summary", summary);
      if (summary.failed > 0) exitCode = 1;
    }
  } catch (error) {
    console.error("Reminder job failed", getSafeErrorMessage(error));
    exitCode = 1;
  } finally {
    try {
      await dependencies.disconnect();
    } catch (error) {
      console.error("Reminder job disconnect failed", getSafeErrorMessage(error));
      exitCode = 1;
    }
  }
  return exitCode;
}

if (import.meta.main) {
  try {
    // Configuration/import failures must also go through the sanitizer.
    const { sendDueReviewReminders } = await import("../src/features/review/notifications/sendDueReviewReminders.js");
    const { prisma } = await import("../src/lib/prisma.js");
    process.exitCode = await runReminderJob({
      run: sendDueReviewReminders,
      disconnect: () => prisma.$disconnect(),
    });
  } catch (error) {
    console.error("Reminder job failed", getSafeErrorMessage(error));
    process.exitCode = 1;
  }
}
