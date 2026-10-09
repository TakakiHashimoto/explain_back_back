import type { KnowledgeGap, ReviewQuestion } from '../types';

export const knowledgeGap: KnowledgeGap = {
  id: 'fake-knowledgegap-id-1',
  concept: 'Dependency comparison',
  misconception: 'React watches dependency variables.',
  severity: 4,
};

export const reviewQuestion: ReviewQuestion = {
  id: 'fake-review-question-id-1',
  gapId: 'fake-knowledgegap-id-1',
  question: 'How does React determine whether a dependency changed between renders?',
};
