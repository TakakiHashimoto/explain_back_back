/// <reference types="bun" />
// Local HTTP + real Express routes/Prisma/PostgreSQL, with simulated Clerk only.
// Requires an isolated, migrated, disposable TEST_DATABASE_URL. All fixtures roll back.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mock } from 'bun:test';

import { getTestDatabaseUrl } from '../../backend/scripts/test-database';
import { getDueReviews } from '../src/features/review/api/api.review';

process.env.DATABASE_URL = getTestDatabaseUrl();
const { prisma } = await import('../../backend/src/lib/prisma');
const subject = `due-reviews-test-${crypto.randomUUID()}`;
const rollback = new Error('Roll back due-review verification fixtures');
const originalFetch = globalThis.fetch;
const previousApiUrl = process.env.EXPO_PUBLIC_API_URL;
let server: Server | undefined;

mock.module(Bun.resolveSync('@clerk/express', new URL('../../backend', import.meta.url).pathname), () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: { headers: { authorization?: string } }) => ({
    isAuthenticated: ['Bearer owner-test-jwt', 'Bearer empty-test-jwt'].includes(req.headers.authorization ?? ''),
    userId: req.headers.authorization === 'Bearer owner-test-jwt' ? subject : `${subject}-empty`,
  }),
}));
mock.module('../../backend/src/lib/ai/openai', () => ({
  openai: { responses: { parse: () => { throw new Error('AI is forbidden in this verification'); } } },
}));

try {
  await prisma.$transaction(async (tx) => {
    mock.module('../../backend/src/lib/prisma', () => ({ prisma: tx }));
    const { app } = await import('../../backend/src/app');
    const now = new Date();
    const owner = await tx.user.create({ data: { authSubject: subject } });
    const other = await tx.user.create({ data: { authSubject: `${subject}-other` } });
    const ownerQuestionIds: string[] = [];
    async function scheduledQuestion(userId: string, index: number, dueAt: Date) {
      const explanation = await tx.explanation.create({
        data: { userId, topic: 'Due reviews integration verification' },
      });
      const gap = await tx.knowledgeGap.create({
        data: {
          explanationId: explanation.id, concept: `Stored concept ${index}`,
          misconception: 'Fixture misconception', severity: 1,
          reviewQuestion: { create: {
            question: `Stored question ${index}?`,
            schedule: { create: { intervalDays: 2, nextReviewAt: dueAt } },
          } },
        },
        include: { reviewQuestion: true },
      });
      assert.ok(gap.reviewQuestion);
      return gap.reviewQuestion.id;
    }
    for (let index = 0; index < 22; index++) {
      ownerQuestionIds.push(await scheduledQuestion(owner.id, index, new Date(now.getTime() - (30 - index) * 60_000)));
    }
    await scheduledQuestion(owner.id, 100, new Date(now.getTime() + 86_400_000));
    await scheduledQuestion(other.id, 200, new Date(now.getTime() - 60_000));

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.EXPO_PUBLIC_API_URL = origin;
    globalThis.fetch = Object.assign((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.origin, origin, 'External HTTP is forbidden');
      return originalFetch(input, init);
    }, { preconnect: () => { throw new Error('External preconnect is forbidden'); } });

    const unauthorized = await fetch(`${origin}/api/v1/reviews/due`);
    assert.equal(unauthorized.status, 401);
    console.log('PASS: Express rejects unauthenticated due-review requests');
    await assert.rejects(getDueReviews(async () => 'invalid-test-jwt'), { code: 'authentication' });
    console.log('PASS: mobile maps the real route 401 to an authentication error');

    const reviews = await getDueReviews(async () => 'owner-test-jwt');
    assert.equal(reviews.length, 20);
    assert.deepEqual(reviews.map((review) => review.questionId), ownerQuestionIds.slice(0, 20));
    console.log('PASS: real route enforces ownership, due selection, ordering and the 20-item limit');
    assert.equal(reviews[0]?.question.question, 'Stored question 0?');
    assert.equal(reviews[0]?.question.knowledgeGap.concept, 'Stored concept 0');
    assert.equal(reviews[0]?.intervalDays, 2);
    assert.equal(typeof reviews[0]?.nextReviewAt, 'string');
    console.log('PASS: mobile validates and returns the actual PostgreSQL response shape');
    assert.deepEqual(await getDueReviews(async () => 'empty-test-jwt'), []);
    console.log('PASS: authenticated user without schedules receives an empty list');
    throw rollback;
  }, { timeout: 30_000 });
} catch (error) {
  if (error !== rollback) throw error;
  assert.equal(await prisma.user.count({ where: { authSubject: { startsWith: subject } } }), 0);
  console.log('PASS: all local verification fixtures rolled back');
} finally {
  globalThis.fetch = originalFetch;
  if (previousApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = previousApiUrl;
  if (server) {
    const closing = new Promise<void>((resolve) => server!.close(() => resolve()));
    server.closeAllConnections();
    await closing;
  }
  await prisma.$disconnect();
}
