import "dotenv/config";
import { sendDueReviewReminders } from "../src/features/review/notifications/sendDueReviewReminders.js";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const now = new Date();
  const dryRun = process.env.NOTIFICATION_DRY_RUN === "true";

  // MVP: reminder creation starts after 16:00 UTC each calendar day.
  // Schedule the script hourly; the database ensures one reminder per day.
  if (now.getUTCHours() < 16) {
    console.log("Before daily UTC reminder window; skipping");
    return;
  }

  const summary = await sendDueReviewReminders(now, { dryRun });
  console.log("Reminder job summary", summary);
  if (summary.failed > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error("Reminder job failed", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
