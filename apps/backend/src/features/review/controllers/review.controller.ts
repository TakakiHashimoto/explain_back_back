import type { NextFunction, Request, Response } from "express";
import { evaluateAnswer } from "../evaluation/fakeEvaluator.js";
import { prisma } from "../../../lib/prisma.js";
import { scheduleReview } from "../scheduling/schedulReview.js";

// This is the controller for having AI review the user's answer and calculate the schedule for next review
export async function reviewAnswers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { questionId } = req.params;

  if (typeof questionId !== "string" || !questionId) {
    res.status(400).json({ error: "Question ID is required" });
    return;
  }
  const answer = req.body?.answer;
  // validate the body
  if (typeof answer !== "string" || !answer.trim()) {
    res.status(400).json({
      error: "Answer must be a non-empty string",
    });
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const reviewQ = await prisma.reviewQuestion.findFirst({
      where: {
        id: questionId,
        knowledgeGap: { explanation: { userId: req.user.id } },
      },
      include: { knowledgeGap: true },
    });
    if (!reviewQ) {
      res.status(404).json({ error: "review question was not found" });
      return;
    }

    // evaluate the body and get result
    const reviewRes = evaluateAnswer(
      answer.trim(),
      reviewQ.knowledgeGap,
      reviewQ,
    );
    const schedule = scheduleReview(reviewRes.score, new Date());

    return res.status(200).json({ data: { reviewRes, schedule } });
  } catch (error) {
    next(error);
  }
}
