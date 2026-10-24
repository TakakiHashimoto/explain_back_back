// this function returns an array of users and due counts for each user
// this is for distinguishing to whome we send notifications (users with due counts)

import { prisma } from "../../../lib/prisma.js";

type DueReviewUser = {
  userId: string;
  dueCount: number;
};

export async function getUsersWithDueReviews(
  now: Date,
): Promise<DueReviewUser[]> {
  const schedules = await prisma.reviewSchedule.findMany({
    where: { nextReviewAt: { lte: now } },
    select: {
      question: {
        select: {
          knowledgeGap: {
            select: { explanation: { select: { userId: true } } },
          },
        },
      },
    },
  });

  const counts = new Map<string, number>();

  for (const s of schedules) {
    const userId = s.question.knowledgeGap.explanation.userId;
    counts.set(userId, (counts.get(userId) ?? 0) + 1);
  }

  return Array.from(counts, ([userId, counts]) => ({
    userId,
    dueCount: counts,
  }));
}
