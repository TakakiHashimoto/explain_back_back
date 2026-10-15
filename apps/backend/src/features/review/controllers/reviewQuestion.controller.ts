import { NextFunction, Request, Response } from "express";
import { knowledgeGap } from "../data/dummy.js";
import { openai } from "../../../lib/ai/openai.js";
import { reviewQuestionInstructions } from "../generation/reveiwQuestionInstructions.js";
import { QuestionSchema } from "../validation/questionSchema.js";
import { prisma } from "../../../lib/prisma.js";
import { zodTextFormat } from "openai/helpers/zod.js";

async function generateReviewQuestion(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { gapId } = req.params;
  if (!gapId) {
    throw new Error("Missing gap id");
  }

  // fing knowledge gap matching with gapId from db
  // for now we use dummy data
  const foundGap = knowledgeGap.find((k) => k.id === gapId);
  if (!foundGap) {
    return res.status(404).json({ error: "Knowledge gap was not found" });
  }

  // based on this fetched knowledge gap, have AI generate revieew question
  const aiRes = await openai.responses.create({
    model: "gpt-6-luna",
    instructions: reviewQuestionInstructions,
    input: JSON.stringify({
      concept: foundGap.concept,
      misconception: foundGap.misconception,
      severity: foundGap.severity,
    }),
    text: {
      format: zodTextFormat(QuestionSchema, "review_question"),
    },
  });
  // validate this review question
  const validationResult = QuestionSchema.safeParse(aiRes);
  if (!validationResult.success) {
    res
      .status(500)
      .json({ error: "The returned review question didn't meet the criteria" });
    return;
  }

  // save this review question in DB
  const data = { gapId: gapId, question: validationResult.data };
  const reviewQ = await prisma.reviewQuestion.create({
    data: data,
    select: {},
  });

  // return this review question
  return res.status(201).json({ data: reviewQ });
}
