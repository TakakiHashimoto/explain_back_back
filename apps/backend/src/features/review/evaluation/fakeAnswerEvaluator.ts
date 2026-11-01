import { ReviewEvaluation } from "../types.js";

// Deterministic evaluator for E2E runs (FAKE_AI_EVALUATION=true). No OpenAI call, no cost.
// Markers in the answer text drive the result, so a Maestro flow can pick it by typing:
//   score=NN    -> score NN (0-100), default 90
//   fail        -> throws, like a failed AI evaluation
//   delay=NNNN  -> waits NNNN ms first (max 60000), to observe loading states
// Markers ignore case: Android keyboards capitalize the first word of a sentence ("Score=60").
const DEFAULT_SCORE = 90;
const MAX_DELAY_MS = 60_000;

export async function fakeEvaluateAnswer(answer: string): Promise<ReviewEvaluation> {
  const delay = answer.match(/\bdelay=(\d{1,5})\b/i);
  if (delay) {
    const ms = Math.min(Number(delay[1]), MAX_DELAY_MS);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  if (/\bfail\b/i.test(answer)) {
    throw new Error("Fake review answer evaluation failed");
  }

  const scoreMatch = answer.match(/\bscore=(\d{1,3})\b/i);
  const score = scoreMatch ? Math.min(Number(scoreMatch[1]), 100) : DEFAULT_SCORE;

  // Same rule the real evaluator enforces: correct exactly when score >= 85.
  return { score, correct: score >= 85, feedback: `[fake] score=${score}` };
}
