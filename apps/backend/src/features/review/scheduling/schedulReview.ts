// schedule next review data based on the score
const DAY_IN_MS = 1000 * 60 * 60 * 24;
export function scheduleReview(score: number, now: Date) {
  const interval = score < 50 ? 1 : score < 70 ? 2 : score < 85 ? 4 : 7;
  const nextReviewAt = new Date(now.getTime() + interval * DAY_IN_MS);
  return { intervalDays: interval, nextReviewAt };
}
