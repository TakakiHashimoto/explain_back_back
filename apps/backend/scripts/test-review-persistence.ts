import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { scheduleReview } from "../src/features/review/scheduling/schedulReview.js";
import type { ReviewEvaluation } from "../src/features/review/types.js";

// Run from apps/backend: bun run scripts/test-review-persistence.ts
// Prefer TEST_DATABASE_URL; otherwise use the configured DATABASE_URL.
// Real service transactions commit independently. Only this run's fixtures are
// removed in finally; an outer transaction would not clean up these writes.
// This script imports neither the evaluator nor the OpenAI client.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

async function main() {
  assert.ok(process.env.DATABASE_URL, "A database URL must be configured");
  // Import after selecting the database used by the service's global client.
  const { prisma } = await import("../src/lib/prisma.js");
  const { saveReviewResult } = await import(
    "../src/features/review/services/saveReviewResult.js"
  );
  const ids = {
    user: randomUUID(),
    explanation: randomUUID(),
    gap: randomUUID(),
    question: randomUUID(),
  };
  const now = new Date("2026-10-19T12:00:00.000Z");
  const low: ReviewEvaluation = {
    score: 40,
    correct: false,
    feedback: "Promise callbacks wait until the current call stack finishes.",
  };
  const high: ReviewEvaluation = {
    score: 95,
    correct: true,
    feedback: "You correctly explained when Promise microtasks run.",
  };
  let connected = false;

  async function readState() {
    const [attempts, schedules] = await Promise.all([
      prisma.reviewAttempt.findMany({
        where: { questionId: ids.question },
        orderBy: { id: "asc" },
      }),
      prisma.reviewSchedule.findMany({
        where: { questionId: ids.question },
      }),
    ]);
    return { attempts, schedules };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    connected = true;
    console.log(
      `Database: ${process.env.TEST_DATABASE_URL ? "TEST_DATABASE_URL" : "DATABASE_URL"}; fixture user: ${ids.user}`,
    );
    // One nested write creates the entire fixture tree atomically.
    await prisma.user.create({
      data: {
        id: ids.user,
        authSubject: `persistence-test-${ids.user}`,
        explanations: {
          create: {
            id: ids.explanation,
            topic: "Persistence integration test: JavaScript Event Loop",
            transcript: "Promise callbacks execute synchronously.",
            knowledgeGaps: {
              create: {
                id: ids.gap,
                concept: "JavaScript Event Loop",
                misconception:
                  "Promise callbacks execute synchronously before the current call stack finishes.",
                severity: 4,
                reviewQuestion: {
                  create: {
                    id: ids.question,
                    question:
                      "How are Promise callbacks scheduled relative to the current call stack?",
                  },
                },
              },
            },
          },
        },
      },
    });
    assert.deepEqual(await readState(), { attempts: [], schedules: [] });

    const firstAnswer = "Promise callbacks interrupt synchronous JavaScript.";
    const first = await saveReviewResult(
      ids.question,
      firstAnswer,
      low,
      scheduleReview(low.score, now),
    );
    const afterFirst = await readState();
    assert.deepEqual(afterFirst.attempts, [first.attempt]);
    assert.deepEqual(afterFirst.schedules, [first.reviewSchedule]);
    assert.equal(first.attempt.questionId, ids.question);
    assert.equal(first.attempt.answer, firstAnswer);
    assert.equal(first.attempt.score, low.score);
    assert.equal(first.attempt.correct, low.correct);
    assert.equal(first.attempt.feedback, low.feedback);
    assert.equal(first.reviewSchedule.questionId, ids.question);
    assert.equal(first.reviewSchedule.intervalDays, 1);
    assert.equal(
      first.reviewSchedule.nextReviewAt.toISOString(),
      "2026-10-20T12:00:00.000Z",
    );
    console.log("PASS: score 40 commits one attempt and a 1-day schedule");

    const secondAnswer = "Promise microtasks run after the call stack finishes.";
    const second = await saveReviewResult(
      ids.question,
      secondAnswer,
      high,
      scheduleReview(high.score, now),
    );
    const beforeFailure = await readState();
    assert.equal(beforeFailure.attempts.length, 2);
    assert.deepEqual(
      beforeFailure.attempts.find((attempt) => attempt.id === first.attempt.id),
      first.attempt,
    );
    assert.deepEqual(
      beforeFailure.attempts.find((attempt) => attempt.id === second.attempt.id),
      second.attempt,
    );
    assert.notEqual(second.attempt.id, first.attempt.id);
    assert.equal(second.attempt.questionId, ids.question);
    assert.equal(second.attempt.answer, secondAnswer);
    assert.equal(second.attempt.score, high.score);
    assert.equal(second.attempt.correct, high.correct);
    assert.equal(second.attempt.feedback, high.feedback);
    assert.deepEqual(beforeFailure.schedules, [second.reviewSchedule]);
    assert.equal(second.reviewSchedule.id, first.reviewSchedule.id);
    assert.deepEqual(second.reviewSchedule.createdAt, first.reviewSchedule.createdAt);
    assert.equal(second.reviewSchedule.intervalDays, 7);
    assert.equal(
      second.reviewSchedule.nextReviewAt.toISOString(),
      "2026-10-26T12:00:00.000Z",
    );
    console.log("PASS: score 95 commits another attempt and updates the same schedule to 7 days");

    // The service awaits the attempt INSERT before Prisma rejects the invalid
    // date in the schedule upsert. This tests rollback on a validation error,
    // not a PostgreSQL constraint violation.
    await assert.rejects(
      () =>
        saveReviewResult(ids.question, "This attempt must roll back.", low, {
          intervalDays: 1,
          nextReviewAt: new Date(Number.NaN),
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.name === "PrismaClientValidationError" &&
        /nextReviewAt/.test(error.message) &&
        /invalid date/i.test(error.message),
      "The third call must fail specifically because nextReviewAt is invalid",
    );
    console.log("PASS: invalid nextReviewAt rejects the third transaction");

    const afterFailure = await readState();
    assert.deepEqual(afterFailure, beforeFailure);
    assert.equal(afterFailure.attempts.length, 2);
    assert.equal(afterFailure.schedules.length, 1);
    console.log("PASS: rollback leaves exactly two attempts and one unchanged schedule");
  } finally {
    try {
      if (connected) {
        // Foreign-key order; every deletion is scoped to this run's random IDs.
        await prisma.$transaction([
          prisma.reviewAttempt.deleteMany({ where: { questionId: ids.question } }),
          prisma.reviewSchedule.deleteMany({ where: { questionId: ids.question } }),
          prisma.reviewQuestion.deleteMany({ where: { id: ids.question } }),
          prisma.knowledgeGap.deleteMany({ where: { id: ids.gap } }),
          prisma.explanation.deleteMany({ where: { id: ids.explanation } }),
          prisma.user.deleteMany({ where: { id: ids.user } }),
        ]);
        const counts = await Promise.all([
          prisma.reviewAttempt.count({ where: { questionId: ids.question } }),
          prisma.reviewSchedule.count({ where: { questionId: ids.question } }),
          prisma.reviewQuestion.count({ where: { id: ids.question } }),
          prisma.knowledgeGap.count({ where: { id: ids.gap } }),
          prisma.explanation.count({ where: { id: ids.explanation } }),
          prisma.user.count({ where: { id: ids.user } }),
        ]);
        assert.deepEqual(counts, [0, 0, 0, 0, 0, 0]);
        console.log("PASS: all of this run's test fixtures removed");
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((error: unknown) => {
  let message = error instanceof Error ? error.message : "Unknown error";
  for (const secret of [
    process.env.DATABASE_URL,
    process.env.TEST_DATABASE_URL,
    process.env.CLERK_SECRET_KEY,
    process.env.OPENAI_API_KEY,
  ]) {
    if (secret) message = message.replaceAll(secret, "[REDACTED]");
  }
  console.error("FAIL:", message);
  process.exitCode = 1;
});
