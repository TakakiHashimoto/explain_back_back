import { DueReviewsError, getReviewQuestion, ReviewSubmissionError, submitReviewAnswer,
  type GetSessionToken } from '../api/api.review';
import type { ReviewQuestionDetail, ReviewResult } from '../types';

export type SubmissionState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string; uncertain: boolean }
  | { status: 'success'; result: ReviewResult };

export type ReviewQuestionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; question: ReviewQuestionDetail; answer: string; submission: SubmissionState };

/** One question/account lifetime. Synchronous state locks out same-tick taps. */
export function createReviewSession(questionId: string, getToken: GetSessionToken,
  onChange: (state: ReviewQuestionState) => void) {
  let state: ReviewQuestionState = { status: 'loading' };
  let disposed = false;
  let request: AbortController | undefined;
  const publish = (next: ReviewQuestionState) => {
    if (disposed) return;
    state = next;
    onChange(next);
  };
  return {
    async load() {
      if (disposed || state.status === 'ready') return;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      publish({ status: 'loading' });
      try {
        const question = await getReviewQuestion(questionId, getToken, { signal: controller.signal });
        if (!controller.signal.aborted) publish({ status: 'ready', question, answer: '', submission: { status: 'idle' } });
      } catch (error) {
        if (!controller.signal.aborted) publish({ status: 'error', message: error instanceof DueReviewsError
          ? error.message : 'We could not load this question. Please try again.' });
      }
    },
    setAnswer(answer: string) {
      if (disposed || state.status !== 'ready' || state.submission.status === 'submitting'
        || state.submission.status === 'success'
        || (state.submission.status === 'error' && state.submission.uncertain)) return;
      publish({ ...state, answer, submission: { status: 'idle' } });
    },
    async submit() {
      if (disposed || state.status !== 'ready' || state.submission.status === 'submitting'
        || state.submission.status === 'success'
        || (state.submission.status === 'error' && state.submission.uncertain)) return;
      const ready = state;
      if (!ready.answer.trim()) {
        publish({ ...ready, submission: { status: 'error', uncertain: false,
          message: 'Enter an answer in your own words before submitting.' } });
        return;
      }
      const controller = new AbortController();
      request = controller;
      publish({ ...ready, submission: { status: 'submitting' } });
      try {
        const result = await submitReviewAnswer(questionId, ready.answer, getToken, { signal: controller.signal });
        if (!controller.signal.aborted) publish({ ...ready, submission: { status: 'success', result } });
      } catch (error) {
        if (!controller.signal.aborted) publish({ ...ready, submission: { status: 'error',
          uncertain: error instanceof ReviewSubmissionError ? error.uncertain : true,
          message: error instanceof ReviewSubmissionError ? error.message
            : 'We could not confirm the result. Return to Review before trying again.' } });
      }
    },
    dispose() {
      disposed = true;
      request?.abort();
    },
  };
}
