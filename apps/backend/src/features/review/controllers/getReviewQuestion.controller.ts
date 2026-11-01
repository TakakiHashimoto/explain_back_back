import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import { sendError } from "../../../lib/errors.js";

/** A reload-safe question DTO, without the misconception or evaluation criteria. */
export async function getReviewQuestionController(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return void sendError(res, "UNAUTHENTICATED");
  const { questionId } = req.params;
  if (typeof questionId !== "string" || !questionId) return void sendError(res, "BAD_REQUEST");

  try {
    const question = await prisma.reviewQuestion.findFirst({
      where: { id: questionId, knowledgeGap: { explanation: { userId: req.user.id } } },
      select: { id: true, question: true, knowledgeGap: { select: { concept: true } } },
    });
    if (!question) return void sendError(res, "NOT_FOUND");
    res.json({ data: question });
  } catch (error) {
    next(error);
  }
}
