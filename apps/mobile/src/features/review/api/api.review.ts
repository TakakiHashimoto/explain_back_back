import type { DueReview, ReviewQuestionDetail, ReviewResult } from '../types';

export type GetSessionToken = () => Promise<string | null>;

type ErrorCode = 'configuration' | 'authentication' | 'http' | 'invalid-response' | 'network' | 'invalid-answer' | 'not-found' | 'timeout';

const messages: Record<ErrorCode, string> = {
  'invalid-answer': 'Enter an answer in your own words before submitting.',
  'not-found': 'This question is unavailable or does not belong to your account.',
  timeout: 'The request took too long. Please check your connection.',
  configuration: 'Reviews are not configured yet. Please contact support.',
  authentication: 'We could not verify your session. Try again, or sign out and sign in again.',
  http: 'Reviews are temporarily unavailable. Please try again.',
  'invalid-response': 'We could not read your reviews. Please try again.',
  network: 'Could not connect to your reviews. Check your connection and try again.',
};

export class DueReviewsError extends Error {
  constructor(readonly code: ErrorCode) {
    super(messages[code]);
    this.name = 'DueReviewsError';
  }
}

function checkCancellation(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error('Review request cancelled');
    error.name = 'AbortError';
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseDueReviews(value: unknown): DueReview[] {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new DueReviewsError('invalid-response');
  }

  return value.data.map((item: unknown) => {
    if (
      !isRecord(item) ||
      !isText(item.questionId) ||
      typeof item.intervalDays !== 'number' ||
      !Number.isInteger(item.intervalDays) ||
      item.intervalDays < 1 ||
      !isText(item.nextReviewAt) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.nextReviewAt) ||
      Number.isNaN(Date.parse(item.nextReviewAt)) ||
      !isRecord(item.question) ||
      item.question.id !== item.questionId ||
      !isText(item.question.question) ||
      !isRecord(item.question.knowledgeGap) ||
      !isText(item.question.knowledgeGap.concept)
    ) {
      throw new DueReviewsError('invalid-response');
    }

    // Construct the DTO only after validating every field; no casts or fallback data.
    return {
      questionId: item.questionId,
      intervalDays: item.intervalDays,
      nextReviewAt: item.nextReviewAt,
      question: {
        id: item.question.id,
        question: item.question.question,
        knowledgeGap: { concept: item.question.knowledgeGap.concept },
      },
    };
  });
}

/** React-independent: the caller supplies Clerk's getToken and owns cancellation. */
export async function getDueReviews(
  getToken: GetSessionToken,
  { signal }: { signal?: AbortSignal } = {},
): Promise<DueReview[]> {
  return parseDueReviews(await requestReviewJSON('/api/v1/reviews/due', getToken, signal));
}

async function requestReviewJSON(
  path: string, getToken: GetSessionToken, signal?: AbortSignal, answer?: string,
): Promise<unknown> {
  checkCancellation(signal);
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  try {
    const url = new URL(baseUrl ?? '');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }
  } catch {
    throw new DueReviewsError('configuration');
  }

  let token: string | null;
  try {
    token = await getToken();
  } catch {
    checkCancellation(signal);
    throw new DueReviewsError('authentication');
  }
  checkCancellation(signal);
  if (!token?.trim()) throw new DueReviewsError('authentication');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: answer === undefined ? 'GET' : 'POST',
      headers: {
        Accept: 'application/json', Authorization: `Bearer ${token}`,
        ...(answer === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(answer === undefined ? {} : { body: JSON.stringify({ answer }) }),
      signal,
    });
  } catch {
    checkCancellation(signal);
    throw new DueReviewsError('network');
  }
  checkCancellation(signal);
  if (response.status === 400 && answer !== undefined) throw new DueReviewsError('invalid-answer');
  if (response.status === 404 && path.startsWith('/api/v1/review-questions/')) throw new DueReviewsError('not-found');
  if (response.status === 401 || response.status === 403) throw new DueReviewsError('authentication');
  if (!response.ok) throw new DueReviewsError('http');

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    checkCancellation(signal);
    throw new DueReviewsError('invalid-response');
  }
  checkCancellation(signal);
  return body;
}

function isTimestamp(value: unknown): value is string {
  return isText(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function parseReviewQuestion(value: unknown, questionId: string): ReviewQuestionDetail {
  const q = isRecord(value) ? value.data : null;
  if (!isRecord(q) || q.id !== questionId || !isText(q.question)
    || !isRecord(q.knowledgeGap) || !isText(q.knowledgeGap.concept)) {
    throw new DueReviewsError('invalid-response');
  }
  return { id: questionId, question: q.question, knowledgeGap: { concept: q.knowledgeGap.concept } };
}

export function parseReviewResult(value: unknown, questionId: string): ReviewResult {
  const data = isRecord(value) ? value.data : null;
  const a = isRecord(data) ? data.attempt : null;
  const s = isRecord(data) ? data.reviewSchedule : null;
  if (!isRecord(a) || !isRecord(s) || !isText(a.id) || !isText(s.id)
    || a.questionId !== questionId || s.questionId !== questionId
    || !isText(a.answer) || typeof a.score !== 'number' || !Number.isInteger(a.score)
    || a.score < 0 || a.score > 100 || typeof a.correct !== 'boolean' || !isText(a.feedback)
    || !isTimestamp(a.createdAt) || !isTimestamp(s.createdAt) || !isTimestamp(s.updatedAt)
    || !isTimestamp(s.nextReviewAt) || typeof s.intervalDays !== 'number'
    || !Number.isInteger(s.intervalDays) || s.intervalDays < 1) {
    throw new DueReviewsError('invalid-response');
  }
  return {
    attempt: { id: a.id, questionId, answer: a.answer, score: a.score, correct: a.correct,
      feedback: a.feedback, createdAt: a.createdAt },
    reviewSchedule: { id: s.id, questionId, intervalDays: s.intervalDays,
      nextReviewAt: s.nextReviewAt, createdAt: s.createdAt, updatedAt: s.updatedAt },
  };
}

/** Cancellation stops waiting locally; it cannot undo a server-side commit. */
async function withDeadline<T>(signal: AbortSignal | undefined, timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  checkCancellation(signal);
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    // Race also covers token acquisition or transports that ignore AbortSignal.
    const interrupted = new Promise<never>((_resolve, reject) => {
      onAbort = () => {
        if (timedOut) reject(new DueReviewsError('timeout'));
        else {
          const error = new Error('Review request cancelled');
          error.name = 'AbortError';
          reject(error);
        }
      };
      controller.signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    });
    return await Promise.race([run(controller.signal), interrupted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    if (onAbort) controller.signal.removeEventListener('abort', onAbort);
  }
}

export async function getReviewQuestion(questionId: string, getToken: GetSessionToken,
  { signal, timeoutMs = 30_000 }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<ReviewQuestionDetail> {
  if (!questionId.trim()) throw new DueReviewsError('not-found');
  return withDeadline(signal, timeoutMs, async (requestSignal) => parseReviewQuestion(
    await requestReviewJSON(`/api/v1/review-questions/${encodeURIComponent(questionId)}`, getToken, requestSignal),
    questionId,
  ));
}

export class ReviewSubmissionError extends Error {
  constructor(readonly uncertain: boolean, message: string) {
    super(message);
    this.name = 'ReviewSubmissionError';
  }
}

export async function submitReviewAnswer(questionId: string, answer: string, getToken: GetSessionToken,
  { signal, timeoutMs = 120_000 }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<ReviewResult> {
  if (!answer.trim()) throw new ReviewSubmissionError(false, messages['invalid-answer']);
  if (!questionId.trim()) throw new ReviewSubmissionError(false, messages['not-found']);
  try {
    // Exactly one POST: neither this client nor its screen retries automatically.
    return await withDeadline(signal, timeoutMs, async (requestSignal) => parseReviewResult(
      await requestReviewJSON(`/api/v1/review-questions/${encodeURIComponent(questionId)}/attempts`,
        getToken, requestSignal, answer.trim()), questionId,
    ));
  } catch (error) {
    if (signal?.aborted) throw error;
    const safeFailure = error instanceof DueReviewsError
      && ['configuration', 'authentication', 'invalid-answer', 'not-found'].includes(error.code);
    throw new ReviewSubmissionError(!safeFailure, safeFailure ? error.message
      : 'We could not confirm the result. Your answer may have been saved. Return to Review and refresh before deciding whether to answer again.');
  }
}
