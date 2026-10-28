/// <reference types="bun" />
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { DueReviewsError, getDueReviews } from './api.review';

const previousUrl = process.env.EXPO_PUBLIC_API_URL;
const getToken = mock(async (): Promise<string | null> => 'clerk-session-jwt');
const item = {
  questionId: 'question-123',
  intervalDays: 2,
  nextReviewAt: '2026-10-27T10:00:00.000Z',
  question: {
    id: 'question-123',
    question: 'Question returned by the server?',
    knowledgeGap: { concept: 'Saved concept' },
  },
};
let fetchMock: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://backend.example.test/';
  getToken.mockReset();
  getToken.mockResolvedValue('clerk-session-jwt');
  fetchMock = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: [item] }));
});
afterEach(() => {
  fetchMock.mockRestore();
  if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = previousUrl;
});

test('GET sends Clerk JWT, normalizes the base URL, forwards cancellation and returns typed data', async () => {
  const signal = new AbortController().signal;
  const reviews = await getDueReviews(getToken, { signal });
  expect(getToken).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('https://backend.example.test/api/v1/reviews/due', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer clerk-session-jwt' },
    signal,
  });
  expect(reviews).toEqual([item]);
  expect(typeof reviews[0]?.nextReviewAt).toBe('string');
});

test('an empty data array is a successful response', async () => {
  fetchMock.mockResolvedValue(Response.json({ data: [] }));
  expect(await getDueReviews(getToken)).toEqual([]);
});

test.each([401, 500])(
  'HTTP %i produces a safe, actionable error without reading the body',
  async (status) => {
    const response = new Response('private response with Authorization: Bearer secret', { status });
    const readJson = spyOn(response, 'json');
    fetchMock.mockResolvedValue(response);
    try {
      await expect(getDueReviews(getToken)).rejects.toMatchObject({
        name: 'DueReviewsError',
        code: status === 401 ? 'authentication' : 'http',
        message:
          status === 401
            ? 'We could not verify your session. Try again, or sign out and sign in again.'
            : 'Reviews are temporarily unavailable. Please try again.',
      });
      expect(readJson).not.toHaveBeenCalled();
    } finally {
      readJson.mockRestore();
    }
  },
);

describe('response validation', () => {
  test.each(
    [
      null,
      [],
      {},
      { data: null },
      { data: {} },
      { data: [null] },
      { data: [{ ...item, questionId: '' }] },
      { data: [{ ...item, intervalDays: '2' }] },
      { data: [{ ...item, intervalDays: 0 }] },
      { data: [{ ...item, intervalDays: 1.5 }] },
      { data: [{ ...item, nextReviewAt: 'not-a-date' }] },
      { data: [{ ...item, nextReviewAt: '2026-99-27T10:00:00.000Z' }] },
      { data: [{ ...item, question: null }] },
      { data: [{ ...item, question: { ...item.question, id: 'wrong-question' } }] },
      { data: [{ ...item, question: { ...item.question, question: ' ' } }] },
      { data: [{ ...item, question: { ...item.question, knowledgeGap: {} } }] },
    ].map((body) => [body]),
  )('rejects invalid response %# instead of substituting dummy data', async (body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    await expect(getDueReviews(getToken)).rejects.toMatchObject({ code: 'invalid-response' });
  });
  test('rejects malformed JSON', async () => {
    fetchMock.mockResolvedValue(new Response('{broken-json'));
    await expect(getDueReviews(getToken)).rejects.toMatchObject({ code: 'invalid-response' });
  });
});

test('network failures never expose the raw error or credentials', async () => {
  fetchMock.mockRejectedValue(new Error('Request failed: Authorization: Bearer clerk-session-jwt'));
  await expect(getDueReviews(getToken)).rejects.toMatchObject({
    code: 'network',
    message: 'Could not connect to your reviews. Check your connection and try again.',
  });
});

test.each([null, '', ' '])('missing token %# never makes a request', async (token) => {
  getToken.mockImplementation(async () => token);
  await expect(getDueReviews(getToken)).rejects.toBeInstanceOf(DueReviewsError);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('Clerk token retrieval errors are safe and never make a request', async () => {
  getToken.mockRejectedValue(new Error('private Clerk details'));
  await expect(getDueReviews(getToken)).rejects.toMatchObject({ code: 'authentication' });
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([undefined, '', 'invalid', 'file:///tmp/api', 'https://user:secret@backend.test'])(
  'invalid configuration %# fails before token retrieval',
  async (url) => {
    if (url === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = url;
    await expect(getDueReviews(getToken)).rejects.toMatchObject({ code: 'configuration' });
    expect(getToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test('already aborted requests do not acquire tokens or send HTTP', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(getDueReviews(getToken, { signal: controller.signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(getToken).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('cancellation while Clerk is resolving prevents HTTP', async () => {
  const controller = new AbortController();
  getToken.mockImplementation(async () => {
    controller.abort();
    return 'obsolete-token';
  });
  await expect(getDueReviews(getToken, { signal: controller.signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('a cancelled fetch remains cancellation rather than a network error', async () => {
  const controller = new AbortController();
  fetchMock.mockImplementation(
    Object.assign(
      async () => {
        controller.abort();
        throw new Error('Transport aborted');
      },
      { preconnect: () => {} },
    ),
  );
  await expect(getDueReviews(getToken, { signal: controller.signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
});

test('cancellation during response parsing discards the result', async () => {
  const controller = new AbortController();
  const response = Response.json({ data: [item] });
  const readJson = spyOn(response, 'json').mockImplementation(async () => {
    controller.abort();
    return { data: [item] };
  });
  fetchMock.mockResolvedValue(response);
  try {
    await expect(getDueReviews(getToken, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  } finally {
    readJson.mockRestore();
  }
});
