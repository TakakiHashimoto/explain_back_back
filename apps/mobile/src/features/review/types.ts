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

export type ReviewQuestionDetail = DueReview['question'];

/** Persisted records returned by POST /review-questions/:questionId/attempts. */
export type ReviewResult = {
  attempt: ReviewEvaluation & {
    id: string;
    questionId: string;
    answer: string;
    createdAt: string;
  };
  reviewSchedule: {
    id: string;
    questionId: string;
    intervalDays: number;
    nextReviewAt: string;
    createdAt: string;
    updatedAt: string;
  };
};
