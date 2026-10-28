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

/** GET /api/v1/reviews/due serializes timestamps as ISO strings. */
export type DueReview = {
  questionId: string;
  intervalDays: number;
  nextReviewAt: string;
  question: {
    id: string;
    question: string;
    knowledgeGap: { concept: string };
  };
};
