import { z } from "zod/v4";

export const EvaluationSchema = z.object({
  score: z.number(),
  correct: z.boolean(),
  feedback: z.string(),
});
