import type { ReviewScheduleDecision } from '../types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function scheduleReview(input: { score: number; now: Date }): ReviewScheduleDecision {
  const { score, now } = input;
  const interval = score < 50 ? 1 : score < 70 ? 2 : score < 85 ? 4 : 7;

  const nowDay = now.getDate();
  const nextReviewDate = nowDay + interval;
  const nextReviewAt = new Date(nextReviewDate);
  return { intervalDays: 7, nextReviewAt: nextReviewAt };
}
