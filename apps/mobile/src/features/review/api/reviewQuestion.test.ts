import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { getReviewQuestion, submitReviewAnswer } from './api.review';
import { deferred, question, result } from './reviewFixtures.test-support';

const originalUrl = process.env.EXPO_PUBLIC_API_URL;
const token = mock(async (): Promise<string | null> => 'session-jwt');
let transport: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/';
  token.mockReset(); token.mockResolvedValue('session-jwt');
  transport = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: result }));
});
afterEach(() => {
  transport.mockRestore();
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalUrl;
});

test('GET retrieves a direct-link question with authentication and strips extra fields', async () => {
  transport.mockResolvedValue(Response.json({ data: { ...question, gapId: 'private', knowledgeGap: {
    concept: question.knowledgeGap.concept, misconception: 'private', severity: 5,
  } } }));
  expect(await getReviewQuestion(question.id, token)).toEqual(question);
  expect(transport.mock.calls[0]?.[0]).toBe(`https://api.example.test/api/v1/review-questions/${question.id}`);
  expect(transport.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer session-jwt' } });
});

test('POST sends the selected ID, trimmed answer and Clerk JWT, returning persisted records', async () => {
  expect(await submitReviewAnswer(question.id, ' After the stack clears. ', token)).toEqual(result);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0]?.[0]).toBe(`https://api.example.test/api/v1/review-questions/${question.id}/attempts`);
  expect(transport.mock.calls[0]?.[1]).toMatchObject({ method: 'POST',
    headers: { Accept: 'application/json', Authorization: 'Bearer session-jwt', 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: result.attempt.answer }),
  });
});

test('question IDs are encoded as a single path segment', async () => {
  const id = 'q/with ?#';
  transport.mockResolvedValue(Response.json({ data: { ...question, id } }));
  await getReviewQuestion(id, token);
  expect(transport.mock.calls[0]?.[0]).toBe('https://api.example.test/api/v1/review-questions/q%2Fwith%20%3F%23');
});

test.each(['', ' \n\t'])('empty answer is rejected before authentication or HTTP %#', async (answer) => {
  await expect(submitReviewAnswer(question.id, answer, token)).rejects.toMatchObject({ uncertain: false });
  expect(token).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled();
});

test.each([400, 401, 403, 404, 429, 500, 503])('POST HTTP %i is safe and never retried', async (status) => {
  transport.mockResolvedValue(new Response('private stack trace session-jwt', { status }));
  try { await submitReviewAnswer(question.id, 'answer', token); throw new Error('must reject'); }
  catch (error) {
    expect(error).toMatchObject({ name: 'ReviewSubmissionError', uncertain: status >= 429 });
    expect((error as Error).message).not.toContain('session-jwt');
  }
  expect(transport).toHaveBeenCalledTimes(1);
});

test.each([401, 403, 404, 500])('GET HTTP %i surfaces authentication, ownership or server error', async (status) => {
  transport.mockResolvedValue(new Response('', { status }));
  await expect(getReviewQuestion(question.id, token)).rejects.toMatchObject({
    code: status === 404 ? 'not-found' : status === 500 ? 'http' : 'authentication',
  });
});

test('missing token cannot send an answer', async () => {
  token.mockResolvedValue(null);
  await expect(submitReviewAnswer(question.id, 'answer', token)).rejects.toMatchObject({ uncertain: false });
  expect(transport).not.toHaveBeenCalled();
});

test('network loss is ambiguous and makes exactly one POST', async () => {
  transport.mockRejectedValue(new Error('private network details'));
  await expect(submitReviewAnswer(question.id, 'answer', token)).rejects.toMatchObject({ uncertain: true });
  expect(transport).toHaveBeenCalledTimes(1);
});

test.each([
  null, {}, { data: null }, { data: { ...result, attempt: { ...result.attempt, questionId: 'wrong' } } },
  { data: { ...result, reviewSchedule: { ...result.reviewSchedule, questionId: 'wrong' } } },
  ...[{ score: -1 }, { score: 101 }, { score: 0.5 }, { correct: 'true' }, { feedback: ' ' }, { id: '' }, { createdAt: 'today' }]
    .map((patch) => ({ data: { ...result, attempt: { ...result.attempt, ...patch } } })),
  ...[{ intervalDays: 0 }, { intervalDays: 1.5 }, { nextReviewAt: '2026-02-30T12:00:00.000Z' }, { updatedAt: '' }]
    .map((patch) => ({ data: { ...result, reviewSchedule: { ...result.reviewSchedule, ...patch } } })),
])('invalid POST response %# is ambiguous, never fake success', async (body) => {
  transport.mockResolvedValue(Response.json(body));
  await expect(submitReviewAnswer(question.id, 'answer', token)).rejects.toMatchObject({ uncertain: true });
  expect(transport).toHaveBeenCalledTimes(1);
});

test('malformed JSON after POST is ambiguous', async () => {
  transport.mockResolvedValue(new Response('{'));
  await expect(submitReviewAnswer(question.id, 'answer', token)).rejects.toMatchObject({ uncertain: true });
});

test.each([{}, { data: { ...question, id: 'wrong' } }, { data: { ...question, knowledgeGap: {} } }])(
  'invalid GET response %# is rejected', async (body) => {
    transport.mockResolvedValue(Response.json(body));
    await expect(getReviewQuestion(question.id, token)).rejects.toMatchObject({ code: 'invalid-response' });
  },
);

test('long evaluation stays pending until response, without additional requests', async () => {
  const response = deferred<Response>(); transport.mockReturnValue(response.promise);
  let finished = false;
  const pending = submitReviewAnswer(question.id, 'answer', token).then((value) => { finished = true; return value; });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(finished).toBe(false); expect(transport).toHaveBeenCalledTimes(1);
  response.resolve(Response.json({ data: result }));
  expect(await pending).toEqual(result);
});

test('evaluation timeout aborts transport and is ambiguous; no automatic retry', async () => {
  transport.mockReturnValue(new Promise(() => {}));
  await expect(submitReviewAnswer(question.id, 'answer', token, { timeoutMs: 5 })).rejects.toMatchObject({ uncertain: true });
  expect(transport.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(transport).toHaveBeenCalledTimes(1);
});

test('GET timeout bounds token retrieval too', async () => {
  token.mockReturnValue(new Promise(() => {}));
  await expect(getReviewQuestion(question.id, token, { timeoutMs: 5 })).rejects.toMatchObject({ code: 'timeout' });
  expect(transport).not.toHaveBeenCalled();
});

test('cancellation during token acquisition prevents POST', async () => {
  const jwt = deferred<string | null>(); token.mockReturnValue(jwt.promise);
  const controller = new AbortController();
  const pending = submitReviewAnswer(question.id, 'answer', token, { signal: controller.signal });
  controller.abort(); jwt.resolve('obsolete');
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(transport).not.toHaveBeenCalled();
});
