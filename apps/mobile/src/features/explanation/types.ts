export type Explanation = {
  id: string;
  topic: string;
  transcript: string;
  createdAt: string;
  knowledgeGaps: {
    id: string;
    concept: string;
    misconception: string;
    severity: number;
  }[];
  analysis: {
    strengths: { concept: string; explanation: string }[];
    gaps: { concept: string; misconception: string; severity: number }[];
    scores: { accuracy: number; clarity: number; completeness: number; overall: number };
  };
  reviewGeneration: { generatedCount: number; failedGapIds: string[] };
};
