import {
  Prisma,
  type ReviewQuestion,
} from "../../../generated/prisma/client.js";
import { AppError } from "../../../lib/errors.js";
import { prisma } from "../../../lib/prisma.js";
import { generateQuestion } from "../generation/generateReviewQuestion.js";

/**
 * Call after KnowledgeGap persistence commits, with the authenticated internal
 * User.id. Safe to retry per gap; never call OpenAI inside a DB transaction.
 * The initial question is due immediately. Answer evaluation owns later dates.
 */
export async function ensureReviewQuestion(userId: string, gapId: string) {
  if (!userId.trim() || !gapId.trim()) throw new AppError("BAD_REQUEST");

  const where = { id: gapId, explanation: { userId } };
  const gap = await prisma.knowledgeGap.findFirst({
    where,
    include: { reviewQuestion: true },
  });
  if (!gap) throw new AppError("NOT_FOUND");

  async function reuse(question: ReviewQuestion) {
    // Also repairs pre-integration questions without resetting an answered one.
    try {
      await prisma.reviewSchedule.upsert({
        where: { questionId: question.id },
        update: {},
        create: {
          questionId: question.id,
          intervalDays: 1,
          nextReviewAt: new Date(),
        },
      });
    } catch (error) {
      // Some Prisma upsert shapes use a read followed by an insert. If another
      // generator/answer wins that race, preserve its schedule unchanged.
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          (await prisma.reviewSchedule.findUnique({
            where: { questionId: question.id },
          }))
        )
      ) {
        throw error;
      }
    }
    return { question, created: false };
  }

  if (gap.reviewQuestion) return reuse(gap.reviewQuestion);

  const question = await generateQuestion(gap);
  try {
    // Prisma nested writes commit both records or neither. A failed AI call
    // never reaches this write, so the persisted gap can be retried unchanged.
    const saved = await prisma.reviewQuestion.create({
      data: {
        gapId,
        question,
        schedule: { create: { intervalDays: 1, nextReviewAt: new Date() } },
      },
    });
    return { question: saved, created: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // gapId is unique: concurrent generators may spend two AI calls, but only
      // one question/schedule survives. Recheck ownership before returning it.
      const winner = await prisma.knowledgeGap.findFirst({
        where,
        include: { reviewQuestion: true },
      });
      if (winner?.reviewQuestion) return reuse(winner.reviewQuestion);
    }
    throw error;
  }
}
