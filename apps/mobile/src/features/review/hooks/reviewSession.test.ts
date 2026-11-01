import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { createReviewSession, type ReviewQuestionState } from './reviewSession';
import { deferred, question, result } from '../api/reviewFixtures.test-support';
import { loadDueReviews } from './loadDueReviews';

const originalUrl = process.env.EXPO_PUBLIC_API_URL;
let transport: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
const token = async () => 'session-jwt';
let changes: ReturnType<typeof mock<(state: ReviewQuestionState) => void>>;
let session: ReturnType<typeof createReviewSession>;
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  transport = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: question }));
  changes = mock((_state: ReviewQuestionState) => {});
  session = createReviewSession(question.id, token, changes);
});
afterEach(() => {
  session.dispose(); transport.mockRestore();
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalUrl;
});
const latest = () => changes.mock.calls.at(-1)?.[0];

test('loads real question and keeps editable answer in session state', async () => {
  await session.load(); session.setAnswer('my explanation');
  expect(latest()).toEqual({ status: 'ready', question, answer: 'my explanation', submission: { status: 'idle' } });
});

test('empty answer shows validation and sends no POST', async () => {
  await session.load(); session.setAnswer(' \n'); await session.submit();
  expect(latest()).toMatchObject({ submission: { status: 'error', uncertain: false, message: expect.stringContaining('Enter an answer') } });
  expect(transport).toHaveBeenCalledTimes(1);
});

test('same-tick double submit and post-success submit cannot create duplicate attempts', async () => {
  await session.load(); session.setAnswer('answer');
  const response = deferred<Response>(); transport.mockReturnValue(response.promise);
  const first = session.submit(); const second = session.submit();
  expect(latest()).toMatchObject({ submission: { status: 'submitting' } });
  session.setAnswer('must not change while pending');
  await Promise.resolve();
  expect(transport).toHaveBeenCalledTimes(2); // one GET + one POST
  response.resolve(Response.json({ data: result })); await Promise.all([first, second]);
  expect(latest()).toMatchObject({ answer: 'answer', submission: { status: 'success', result } });
  await session.submit(); await session.load();
  expect(transport).toHaveBeenCalledTimes(2);
});

test('ambiguous failure retains answer and locks out resubmission and reload', async () => {
  await session.load(); session.setAnswer('keep me'); transport.mockRejectedValue(new Error('lost'));
  await session.submit();
  expect(latest()).toMatchObject({ answer: 'keep me', submission: { status: 'error', uncertain: true } });
  await session.submit(); await session.load(); session.setAnswer('replacement');
  expect(latest()).toMatchObject({ answer: 'keep me' }); expect(transport).toHaveBeenCalledTimes(2);
});

test('definite rejection preserves answer and allows an explicit corrected submission', async () => {
  await session.load(); session.setAnswer('answer');
  transport.mockResolvedValueOnce(new Response('', { status: 401 })); await session.submit();
  expect(latest()).toMatchObject({ answer: 'answer', submission: { status: 'error', uncertain: false } });
  transport.mockResolvedValue(Response.json({ data: result })); await session.submit();
  expect(latest()).toMatchObject({ submission: { status: 'success', result } });
});

test('missing question shows an error and a deliberate retry can recover', async () => {
  transport.mockResolvedValueOnce(new Response('', { status: 404 })); await session.load();
  expect(latest()).toMatchObject({ status: 'error', message: expect.stringContaining('unavailable') });
  await session.load(); expect(latest()).toMatchObject({ status: 'ready', question });
});

test.each(['resolve', 'reject'] as const)('unmount/account change during submission ignores late %s', async (outcome) => {
  await session.load(); session.setAnswer('answer');
  const response = deferred<Response>(); transport.mockReturnValue(response.promise);
  const pending = session.submit(); await Promise.resolve(); session.dispose();
  const count = changes.mock.calls.length;
  if (outcome === 'resolve') response.resolve(Response.json({ data: result }));
  else response.reject(new Error('late failure'));
  await pending; expect(changes).toHaveBeenCalledTimes(count);
  expect(transport.mock.calls.at(-1)?.[1]?.signal?.aborted).toBe(true);
});

test('obsolete GET cannot overwrite a newer load', async () => {
  const response = deferred<Response>(); transport.mockReturnValueOnce(response.promise);
  const old = session.load(); await Promise.resolve();
  await session.load(); response.resolve(Response.json({ data: { ...question, question: 'obsolete' } }));
  await old; expect(latest()).toMatchObject({ status: 'ready', question });
});

test('disposed session cannot publish or start requests', async () => {
  session.dispose(); await session.load(); await session.submit(); session.setAnswer('answer');
  expect(changes).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled();
});

test('return refresh fetches server due-list after persisted success; no local schedule calculation', async () => {
  await session.load(); session.setAnswer('answer');
  transport.mockResolvedValueOnce(Response.json({ data: result })); await session.submit();
  expect(latest()).toMatchObject({ submission: { status: 'success', result } });
  session.dispose(); transport.mockResolvedValueOnce(Response.json({ data: [] }));
  const refreshed = mock(() => {});
  await loadDueReviews(token, new AbortController().signal, refreshed);
  expect(transport.mock.calls.at(-1)?.[0]).toBe('https://api.example.test/api/v1/reviews/due');
  expect(refreshed).toHaveBeenLastCalledWith({ status: 'success', reviews: [] });
});
