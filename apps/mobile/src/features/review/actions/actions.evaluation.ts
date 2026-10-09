import { KnowledgeGap, ReviewEvaluation, ReviewQuestion } from '../types';

function evaluateReviewAnswer(
  knowledgeGap: KnowledgeGap,
  reviewQuestion: ReviewQuestion,
  answer: string,
) {
  const evaluation: ReviewEvaluation = {
    score: 91,
    correct: true,
    feedback: 'You correctly explained that React compares dependency values between renders.',
  };
  return evaluation;
}
