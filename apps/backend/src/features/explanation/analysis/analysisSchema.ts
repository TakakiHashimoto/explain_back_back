import { z } from "zod";

const score = z.number().int().min(0).max(100);

/** Runtime contract for the external model; matches the current Prisma Int severity. */
export const AnalysisSchema = z.object({
  strengths: z.array(z.object({
    concept: z.string().trim().min(1).max(200),
    explanation: z.string().trim().min(1).max(1000),
  })).max(5),
  gaps: z.array(z.object({
    concept: z.string().trim().min(1).max(200),
    misconception: z.string().trim().min(1).max(1000),
    severity: z.number().int().min(1).max(3),
  })).max(5),
  scores: z.object({
    accuracy: score,
    clarity: score,
    completeness: score,
    overall: score,
  }),
});

export type AnalysisResult = z.infer<typeof AnalysisSchema>;
