import { DueReviewsError, getDueReviews, type GetSessionToken } from '../api/api.review';
import type { DueReview } from '../types';

export type DueReviewsState =
  | { status: 'loading' }
  | { status: 'success'; reviews: DueReview[] }
  | { status: 'error'; message: string };

/** A single screen request. Its owner aborts it on blur, retry or unmount. */
export async function loadDueReviews(
  getToken: GetSessionToken,
  signal: AbortSignal,
  onChange: (state: DueReviewsState) => void,
): Promise<void> {
  if (signal.aborted) return;
  onChange({ status: 'loading' });
  try {
    const reviews = await getDueReviews(getToken, { signal });
    if (!signal.aborted) onChange({ status: 'success', reviews });
  } catch (error) {
    if (signal.aborted) return;
    onChange({
      status: 'error',
      message:
        error instanceof DueReviewsError
          ? error.message
          : 'We could not load your reviews. Please try again.',
    });
  }
}
