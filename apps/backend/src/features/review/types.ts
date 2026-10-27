export type KnowledgeGap = {
  id: string;
  concept: string;
  misconception: string;
  severity: number;
};

export type ReviewQuestion = {
  id: string;
  gapId: string;
  question: string;
};

export type ReviewEvaluation = {
  score: number;
  correct: boolean;
  feedback: string;
};

export type ReviewScheduleDecision = {
  intervalDays: number;
  nextReviewAt: Date;
};
