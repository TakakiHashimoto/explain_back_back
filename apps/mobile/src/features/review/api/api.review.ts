import type { DueReview } from '../types';

export type GetSessionToken = () => Promise<string | null>;

type ErrorCode = 'configuration' | 'authentication' | 'http' | 'invalid-response' | 'network';

const messages: Record<ErrorCode, string> = {
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
    response = await fetch(`${baseUrl}/api/v1/reviews/due`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal,
    });
  } catch {
    checkCancellation(signal);
    throw new DueReviewsError('network');
  }
  checkCancellation(signal);
  if (response.status === 401) throw new DueReviewsError('authentication');
  if (!response.ok) throw new DueReviewsError('http');

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    checkCancellation(signal);
    throw new DueReviewsError('invalid-response');
  }
  checkCancellation(signal);
  return parseDueReviews(body);
}
