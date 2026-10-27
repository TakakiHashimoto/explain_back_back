// This function get due dates before today

import { prisma } from "../../../lib/prisma.js";

// This is for getting reviews that users should review today
export async function getDueReviews(userId: string, now: Date) {
  const schedules = await prisma.reviewSchedule.findMany({
    where: {
      nextReviewAt: { lte: now },
      question: { knowledgeGap: { explanation: { userId } } },
    },
    orderBy: { nextReviewAt: "asc" },
    take: 20,
    select: {
      questionId: true,
      intervalDays: true,
      nextReviewAt: true,
      question: {
        select: {
          id: true,
          question: true,
          knowledgeGap: { select: { concept: true } },
        },
      },
    },
  });

  return schedules;
}
