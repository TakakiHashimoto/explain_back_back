import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getTestDatabaseUrl } from "../test-database.js";

// Run against a migrated, disposable PostgreSQL database:
// TEST_DATABASE_URL=postgresql://... bun test scripts/account-deletion.test.ts
// No fallback to the application's DATABASE_URL; RevenueCat and OneSignal are stubbed.
// Checks spec §16 / 合-9: deleting an account removes the user's rows from every table
// (onDelete: Cascade), and only that user's rows.
// Runs in its own process (see ../account-deletion.test.ts): importing src/lib/prisma.js here
// would otherwise cache a Prisma client that other DB suites in the same process then reuse.
const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = getTestDatabaseUrl();

// The client must be imported after selecting the test database.
const { prisma } = await import("../../src/lib/prisma.js");
const { deleteAccountData } = await import("../../src/features/me/deleteAccount.js");

const previousEnv = {
  revenueCatKey: process.env.REVENUECAT_SECRET_API_KEY,
  oneSignalAppId: process.env.ONESIGNAL_APP_ID,
  oneSignalKey: process.env.ONESIGNAL_REST_API_KEY,
};
const realFetch = globalThis.fetch;
let externalCalls: string[] = [];

/** Creates a user with one row in every table below User. */
async function createUserWithEverything() {
  const user = await prisma.user.create({
    data: { authSubject: `user_test_${randomUUID()}` },
  });
  await prisma.entitlement.create({
    data: { userId: user.id, source: "test", expiresAt: null },
  });
  await prisma.usageRecord.create({
    data: { userId: user.id, kind: "ANALYSIS", status: "SUCCEEDED" },
  });
  await prisma.reviewReminder.create({
    data: { userId: user.id, reminderDate: new Date("2026-11-21"), dueCount: 1 },
  });
  const explanation = await prisma.explanation.create({
    data: { userId: user.id, topic: "Cascades", transcript: "test" },
  });
  const gap = await prisma.knowledgeGap.create({
    data: {
      explanationId: explanation.id,
      concept: "onDelete",
      misconception: "Children are deleted automatically without Cascade",
      severity: 2,
    },
  });
  const question = await prisma.reviewQuestion.create({
    data: { gapId: gap.id, question: "What does onDelete: Cascade do?" },
  });
  await prisma.reviewAttempt.create({
    data: {
      questionId: question.id,
      answer: "It deletes child rows",
      score: 90,
      correct: true,
      feedback: "Right",
    },
  });
  await prisma.reviewSchedule.create({
    data: {
      questionId: question.id,
      intervalDays: 1,
      nextReviewAt: new Date("2026-11-22"),
    },
  });
  return { userId: user.id, explanationId: explanation.id, gapId: gap.id, questionId: question.id };
}

type Fixture = Awaited<ReturnType<typeof createUserWithEverything>>;

/** Row counts for one fixture, table by table. */
async function counts(f: Fixture) {
  return {
    user: await prisma.user.count({ where: { id: f.userId } }),
    entitlement: await prisma.entitlement.count({ where: { userId: f.userId } }),
    usageRecord: await prisma.usageRecord.count({ where: { userId: f.userId } }),
    reviewReminder: await prisma.reviewReminder.count({ where: { userId: f.userId } }),
    explanation: await prisma.explanation.count({ where: { id: f.explanationId } }),
    knowledgeGap: await prisma.knowledgeGap.count({ where: { id: f.gapId } }),
    reviewQuestion: await prisma.reviewQuestion.count({ where: { id: f.questionId } }),
    reviewAttempt: await prisma.reviewAttempt.count({ where: { questionId: f.questionId } }),
    reviewSchedule: await prisma.reviewSchedule.count({ where: { questionId: f.questionId } }),
  };
}

const allOne = {
  user: 1, entitlement: 1, usageRecord: 1, reviewReminder: 1, explanation: 1,
  knowledgeGap: 1, reviewQuestion: 1, reviewAttempt: 1, reviewSchedule: 1,
};
const allZero = Object.fromEntries(
  Object.keys(allOne).map((k) => [k, 0]),
) as Record<keyof typeof allOne, number>;

let target: Fixture;
let bystander: Fixture;

beforeAll(async () => {
  target = await createUserWithEverything();
  bystander = await createUserWithEverything();

  process.env.REVENUECAT_SECRET_API_KEY = "test-revenuecat-secret";
  process.env.ONESIGNAL_APP_ID = "test-onesignal-app";
  process.env.ONESIGNAL_REST_API_KEY = "test-onesignal-key";
  // Never reach the real services: answer every RevenueCat/OneSignal call with 200.
  // Everything else goes through, so a stub left behind (a failed setup) cannot break
  // anything else.
  globalThis.fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith("https://api.revenuecat.com/") || url.startsWith("https://api.onesignal.com/")) {
        externalCalls.push(url);
        return Response.json({}, { status: 200 });
      }
      return realFetch(input, init);
    },
    { preconnect: realFetch.preconnect },
  ) as typeof fetch;
});

afterAll(async () => {
  globalThis.fetch = realFetch;
  // Clean up only this test's own rows (Cascade removes the children).
  const ids = [target?.userId, bystander?.userId].filter((id): id is string => !!id);
  if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
  process.env.DATABASE_URL = previousDatabaseUrl;
  process.env.REVENUECAT_SECRET_API_KEY = previousEnv.revenueCatKey;
  process.env.ONESIGNAL_APP_ID = previousEnv.oneSignalAppId;
  process.env.ONESIGNAL_REST_API_KEY = previousEnv.oneSignalKey;
});

describe("account deletion cascade (real database)", () => {
  test("the fixtures have a row in every table", async () => {
    expect(await counts(target)).toEqual(allOne);
    expect(await counts(bystander)).toEqual(allOne);
  });

  test("deleteAccountData removes the user's rows from every table", async () => {
    await deleteAccountData(target.userId);
    expect(await counts(target)).toEqual(allZero);
  });

  test("another user's rows are untouched", async () => {
    expect(await counts(bystander)).toEqual(allOne);
  });

  test("a second call succeeds (idempotent)", async () => {
    await deleteAccountData(target.userId);
    expect(await counts(target)).toEqual(allZero);
  });

  test("only RevenueCat and OneSignal were called, with the internal User.id", () => {
    expect(externalCalls.length).toBeGreaterThan(0);
    for (const url of externalCalls) {
      expect(decodeURIComponent(url.split("/").at(-1)!)).toBe(target.userId);
    }
  });
});
