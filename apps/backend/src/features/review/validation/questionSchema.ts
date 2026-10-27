import { z } from "zod/v4";

export const QuestionSchema = z.object({
  question: z.string(),
});
