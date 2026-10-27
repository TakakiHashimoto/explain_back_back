import { prisma } from "../../../lib/prisma.js";

export async function getHistory(userId: string) {
  const historis = await prisma.reviewAttempt.findMany({
    where: {
      question: { knowledgeGap: { explanation: { userId } } },
    },
    select: {
      id: true,
      answer: true,
      score: true,
      correct: true,
      feedback: true,
      createdAt: true,
      question: {
        select: {
          id: true,
          question: true,
          knowledgeGap: { select: { concept: true } },
        },
      },
    },

    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
  });

  return historis;
}
