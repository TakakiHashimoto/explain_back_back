import type { ReviewQuestionDetail, ReviewResult } from '../types';

export const question: ReviewQuestionDetail = {
  id: 'question-123', question: 'When do Promise callbacks execute?', knowledgeGap: { concept: 'Event loop' },
};
export const result: ReviewResult = {
  attempt: { id: 'attempt-1', questionId: question.id, answer: 'After the stack clears.',
    score: 91, correct: true, feedback: 'You identified the microtask queue.', createdAt: '2026-10-31T12:00:00.000Z' },
  reviewSchedule: { id: 'schedule-1', questionId: question.id, intervalDays: 7,
    nextReviewAt: '2026-11-07T12:00:00.000Z', createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-31T12:00:00.000Z' },
};
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
