import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../../../generated/prisma/client.js";
import { openai } from "../../../lib/ai/openai.js";
import { QuestionSchema } from "../validation/questionSchema.js";
import { prisma } from "../../../lib/prisma.js";
import { zodTextFormat } from "openai/helpers/zod.js";
import { reviewQuestionInstructions } from "../generation/reveiwQuestionInstructions.js";

export async function generateReviewQuestion(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { gapId } = req.params;
  if (typeof gapId !== "string" || !gapId.trim()) {
    return res.status(400).json({ error: "Gap ID is required" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const foundGap = await prisma.knowledgeGap.findFirst({
      where: { id: gapId, explanation: { userId: req.user.id } },
      include: { reviewQuestion: true },
    });
    if (!foundGap) {
      return res.status(404).json({ error: "Knowledge gap was not found" });
    }

    if (foundGap.reviewQuestion) {
      return res.status(200).json({ data: foundGap.reviewQuestion });
    }

    const aiRes = await openai.responses.parse({
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
    if (aiRes.status !== "completed" || !aiRes.output_parsed) {
      return res
        .status(500)
        .json({ error: "Review question generation failed" });
    }

    try {
      const reviewQ = await prisma.reviewQuestion.create({
        data: { gapId, question: aiRes.output_parsed.question },
      });

      return res.status(201).json({ data: reviewQ });
    } catch (error) {
      // A concurrent request may have created the question after our lookup.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existingQuestion = await prisma.reviewQuestion.findUnique({
          where: { gapId },
        });
        if (existingQuestion) {
          return res.status(200).json({ data: existingQuestion });
        }
      }

      throw error;
    }
  } catch (error) {
    next(error);
  }
}
