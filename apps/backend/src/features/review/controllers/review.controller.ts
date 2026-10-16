import { NextFunction, Request, Response } from "express";
import { evaluateAnswer } from "../evaluation/fakeEvaluator.js";
import { knowledgeGap, reviewQuestion } from "../data/dummy.js";
import { scheduleReview } from "../scheduling/schedulReview.js";

export function reviewAnswers(req: Request, res: Response, next: NextFunction) {
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

  // get reviewQuestion
  const reviewQ = reviewQuestion.find((q) => q.id === questionId);
  if (!reviewQ) {
    res.status(404).json({ error: "review question was not found" });
    return;
  }
  // get knowledgeGap

  const knowledgeG = knowledgeGap.find((gap) => gap.id === reviewQ?.gapId);
  if (!knowledgeG) {
    res.status(404).json({ error: "knowledge gap was not found" });
    return;
  }

  // evaluate the body and get result
  const reviewRes = evaluateAnswer(answer.trim(), knowledgeG, reviewQ);
  const schedule = scheduleReview(reviewRes.score, new Date());

  return res.status(200).json({ data: { reviewRes, schedule } });
}
