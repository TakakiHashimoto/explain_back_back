import { NextFunction, Request, Response } from "express";
import { knowledgeGap } from "../data/dummy.js";
import { openai } from "../../../lib/ai/openai.js";
import { reviewQuestionInstructions } from "../../../lib/ai/instructions/reveiwQuestionInstructions.js";

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
    model: "gpt-6-astra",
    instructions: reviewQuestionInstructions,
    input: foundGap.misconception,
  });
  // validate this review question

  // save this review question in DB

  // return this review question
}
