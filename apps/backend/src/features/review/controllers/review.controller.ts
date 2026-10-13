import { NextFunction, Request, Response } from "express";
import { evaluateAnswer } from "../evaluation/fakeEvaluator.js";
import { knowledgeGap, reviewQuestion } from "../data/dummy.js";
import { scheduleReview } from "../scheduling/schedulReview.js";

async function reviewAnswers(req: Request, res: Response, next: NextFunction) {
  const { questionId } = req.params;

  if (!questionId) {
    throw new Error("No question id is provided");
  }

  const body = req.body;
  // validate the body

  // get reviewQuestion
  const reviewQ = reviewQuestion.find((q) => q.id === questionId);
  if (!reviewQ) {
    return res.status(404).json({ error: "review question was not found" });
  }
  // get knowledgeGap

  const knowledgeG = knowledgeGap.find((gap) => gap.id === reviewQ?.gapId);
  if (!knowledgeG) {
    return res.status(404).json({ error: "knowledge gap was not found" });
  }

  // evaluate the body and get result
  const reviewRes = evaluateAnswer(body, knowledgeG, reviewQ);
  const schedule = scheduleReview(reviewRes.score, new Date());

  return "";
}
