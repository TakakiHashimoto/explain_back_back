import { zodTextFormat } from "openai/helpers/zod.js";
import { openai } from "../../../lib/ai/openai.js";
import { KnowledgeGap, ReviewEvaluation, ReviewQuestion } from "../types.js";
import { reviewEvaluationInstruction } from "./reviewEvaluationInstructions.js";
import { EvaluationSchema } from "../validation/validationSchema.js";
import { fakeEvaluateAnswer } from "./fakeAnswerEvaluator.js";

// E2E only (`bun run dev:e2e`). Refuse to start if it ever leaks into production.
const useFakeEvaluation = process.env.FAKE_AI_EVALUATION === "true";
if (useFakeEvaluation && process.env.NODE_ENV === "production") {
  throw new Error("FAKE_AI_EVALUATION must not be enabled in production");
}

export async function evaluateAnswer(
  answer: string,
  knowledgeGap: KnowledgeGap,
  reviewQuestion: ReviewQuestion,
): Promise<ReviewEvaluation> {
  if (useFakeEvaluation) return fakeEvaluateAnswer(answer);

  const aiRes = await openai.responses.parse({
    model: "gpt-6-luna",
    instructions: reviewEvaluationInstruction,
    input: JSON.stringify({
      concept: knowledgeGap.concept,
      misconception: knowledgeGap.misconception,
      question: reviewQuestion.question,
      answer,
    }),
    text: {
      format: zodTextFormat(EvaluationSchema, "review_evaluation"),
    },
  });
  if (aiRes.status !== "completed" || !aiRes.output_parsed) {
    throw new Error("Review answer evaluation failed");
  }

  const review = aiRes.output_parsed;

  // validating ai's review
  if (
    !Number.isInteger(review.score) ||
    review.score < 0 ||
    review.score > 100
  ) {
    throw new Error("Invalid evaluation score");
  }

  if (review.correct !== review.score >= 85) {
    throw new Error("Inconsistent evaluation correctness");
  }

  const feedback = review.feedback.trim();

  if (!feedback) {
    throw new Error("Evaluation feedback cannot be empty");
  }

  return { ...review, feedback };
}
