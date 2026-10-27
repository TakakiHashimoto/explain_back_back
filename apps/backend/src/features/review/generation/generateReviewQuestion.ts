import { KnowledgeGap } from "../types.js";
import { openai } from "../../../lib/ai/openai.js";
import { reviewQuestionInstructions } from "./reveiwQuestionInstructions.js";
import { zodTextFormat } from "openai/helpers/zod.js";
import { QuestionSchema } from "../validation/questionSchema.js";

export async function generateQuestion(gap: KnowledgeGap) {
  const aiRes = await openai.responses.parse({
    model: "gpt-6-luna",
    instructions: reviewQuestionInstructions,
    input: JSON.stringify({
      concept: gap.concept,
      misconception: gap.misconception,
      severity: gap.severity,
    }),
    text: {
      format: zodTextFormat(QuestionSchema, "review_question"),
    },
  });
  if (aiRes.status !== "completed" || !aiRes.output_parsed) {
    throw new Error("Review question generation failed");
  }

  const question = aiRes.output_parsed.question.trim();

  if (!question || question.length > 1000) {
    throw new Error("Generated question failed validation");
  }

  return question;
}
