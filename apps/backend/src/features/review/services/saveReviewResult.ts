import { prisma } from "../../../lib/prisma.js";
import { completeUsage } from "../../usage/usage.service.js";
import type { ReviewEvaluation, ReviewScheduleDecision } from "../types.js";

export async function saveReviewResult(
  questionId: string,
  answer: string,
  evaluation: ReviewEvaluation,
  schedule: ReviewScheduleDecision,
  usageRecordId: string,
) {
  // this function saves attemps and scheduel and both needs to be transaction
  return prisma.$transaction(async (tx) => {
    // 1. Create ReviewAttempt
    const attempt = await tx.reviewAttempt.create({
      data: { questionId, answer, ...evaluation },
    });
    // 2. Upsert ReviewSchedule
    const reviewSchedule = await tx.reviewSchedule.upsert({
      where: { questionId: questionId },
      update: {
        intervalDays: schedule.intervalDays,
        nextReviewAt: schedule.nextReviewAt,
      },
      create: {
        questionId,
        intervalDays: schedule.intervalDays,
        nextReviewAt: schedule.nextReviewAt,
      },
    });

    // 3. Mark the usage record as SUCCEEDED in the same transaction
    await completeUsage(usageRecordId, true, tx);

    // 4. Return both database records
    return { attempt, reviewSchedule };
  });
}
