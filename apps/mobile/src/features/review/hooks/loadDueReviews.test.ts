/// <reference types="bun" />
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';

import { loadDueReviews, type DueReviewsState } from './loadDueReviews';

const previousUrl = process.env.EXPO_PUBLIC_API_URL;
const reviews = [{
  questionId: 'q1', intervalDays: 1, nextReviewAt: '2026-10-27T00:00:00.000Z',
  question: { id: 'q1', question: 'A saved review question?', knowledgeGap: { concept: 'Saved concept' } },
}];
let fetchMock: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
const token = mock(async () => 'test-jwt');

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://backend.example.test';
  token.mockClear();
  fetchMock = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: reviews }));
});
afterEach(() => {
  fetchMock.mockRestore();
  if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = previousUrl;
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('publishes loading before the request resolves, then the real server result', async () => {
  const response = deferred<Response>();
  fetchMock.mockReturnValue(response.promise);
  const states: DueReviewsState[] = [];
  const loading = loadDueReviews(token, new AbortController().signal, (state) => states.push(state));
  expect(states).toEqual([{ status: 'loading' }]);
  response.resolve(Response.json({ data: reviews }));
  await loading;
  expect(states).toEqual([{ status: 'loading' }, { status: 'success', reviews }]);
});

test('an empty result remains empty, with no fallback questions', async () => {
  fetchMock.mockResolvedValue(Response.json({ data: [] }));
  const states: DueReviewsState[] = [];
  await loadDueReviews(token, new AbortController().signal, (state) => states.push(state));
  expect(states.at(-1)).toEqual({ status: 'success', reviews: [] });
});

test('failure can be retried successfully with a fresh token request', async () => {
  fetchMock.mockResolvedValueOnce(new Response('private error', { status: 500 }));
  const states: DueReviewsState[] = [];
  const publish = (state: DueReviewsState) => states.push(state);
  await loadDueReviews(token, new AbortController().signal, publish);
  expect(states.at(-1)).toEqual({ status: 'error', message: 'Reviews are temporarily unavailable. Please try again.' });
  await loadDueReviews(token, new AbortController().signal, publish);
  expect(states.map((state) => state.status)).toEqual(['loading', 'error', 'loading', 'success']);
  expect(token).toHaveBeenCalledTimes(2);
});

test.each(['resolve', 'reject'] as const)('unmount/blur suppresses a late %s even when transport ignores cancellation', async (completion) => {
  const response = deferred<Response>();
  fetchMock.mockReturnValue(response.promise);
  const controller = new AbortController();
  const publish = mock((_state: DueReviewsState) => {});
  const loading = loadDueReviews(token, controller.signal, publish);
  await Promise.resolve();
  controller.abort();
  if (completion === 'resolve') response.resolve(Response.json({ data: reviews }));
  else response.reject(new Error('late private failure'));
  await loading;
  expect(publish.mock.calls).toEqual([[{ status: 'loading' }]]);
});

test('an obsolete request cannot replace a newer result', async () => {
  const oldResponse = deferred<Response>();
  fetchMock.mockReturnValueOnce(oldResponse.promise);
  const oldController = new AbortController();
  const states: DueReviewsState[] = [];
  const publish = (state: DueReviewsState) => states.push(state);
  const oldRequest = loadDueReviews(token, oldController.signal, publish);
  await Promise.resolve();
  oldController.abort();
  await loadDueReviews(token, new AbortController().signal, publish);
  oldResponse.resolve(Response.json({ data: [] }));
  await oldRequest;
  expect(states.map((state) => state.status)).toEqual(['loading', 'loading', 'success']);
  expect(states.at(-1)).toEqual({ status: 'success', reviews });
});

test('already cancelled lifecycle does not publish or request anything', async () => {
  const controller = new AbortController();
  controller.abort();
  const publish = mock((_state: DueReviewsState) => {});
  await loadDueReviews(token, controller.signal, publish);
  expect(publish).not.toHaveBeenCalled();
  expect(token).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});
