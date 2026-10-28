import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { Client } from "pg";
import { getTestDatabaseUrl } from "./test-database.js";
import { runReminderJob } from "./run-due-review-reminders.js";

// Run against a migrated, disposable PostgreSQL database:
// TEST_DATABASE_URL=postgresql://... bun run test:reminders
// No fallback to the application's DATABASE_URL; no real HTTP requests.
const previousDatabaseUrl = process.env.DATABASE_URL;
const databaseUrl = new URL(getTestDatabaseUrl());
const applicationName = `reminder-test-${randomUUID()}`;
databaseUrl.searchParams.set("application_name", applicationName);
process.env.DATABASE_URL = databaseUrl.toString();

// The service client must be imported after selecting the test database.
const { prisma } = await import("../src/lib/prisma.js");
const { claimReminder } = await import("../src/features/review/notifications/claimReminder.js");
const { finishReminder, markReminderFailed } = await import("../src/features/review/notifications/finishReminder.js");
const { sendReviewReminder } = await import("../src/features/review/notifications/sendReviewReminder.js");
const { sendDueReviewReminders } = await import("../src/features/review/notifications/sendDueReviewReminders.js");
const { createReminder } = await import("../src/features/review/notifications/createReminder.js");

const userId = randomUUID();
const now = new Date("2026-10-26T12:00:00.000Z");
const leaseMs = 2 * 60 * 1000;
const retryMs = 30 * 60 * 1000;
let fixtureDay = 0;
let allowSend = false;
let httpCalls = 0;
let transactionCalls = 0;
const previousAppId = process.env.ONESIGNAL_APP_ID;
const previousApiKey = process.env.ONESIGNAL_REST_API_KEY;

const transactionSpy = spyOn(prisma, "$transaction").mockImplementation(() => {
  transactionCalls++;
  throw new Error("Reminder helpers must not open a transaction around HTTP");
});
const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input, init) => {
  httpCalls++;
  assert.ok(allowSend, "State transitions must never contact OneSignal");
  assert.equal(transactionCalls, 0);
  assert.equal(String(input), "https://api.onesignal.com/notifications");
  assert.equal(init?.method, "POST");
  return Response.json({ id: "simulated-onesignal-id" });
}) as typeof fetch);

async function fixture() {
  return prisma.reviewReminder.create({
    data: {
      userId,
      reminderDate: new Date(Date.UTC(2026, 0, ++fixtureDay)),
      dueCount: 2,
    },
  });
}

async function state(id: string) {
  return prisma.reviewReminder.findUniqueOrThrow({ where: { id } });
}

async function claimed() {
  const reminder = await fixture();
  const token = await claimReminder(reminder.id, now);
  assert.ok(token);
  return { reminder, token };
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, authSubject: applicationName } });
});

afterAll(async () => {
  try {
    await prisma.user.deleteMany({ where: { id: userId } });
    expect(await prisma.reviewReminder.count({ where: { userId } })).toBe(0);
    expect(transactionCalls).toBe(0);
  } finally {
    fetchSpy.mockRestore();
    transactionSpy.mockRestore();
    if (previousAppId === undefined) delete process.env.ONESIGNAL_APP_ID;
    else process.env.ONESIGNAL_APP_ID = previousAppId;
    if (previousApiKey === undefined) delete process.env.ONESIGNAL_REST_API_KEY;
    else process.env.ONESIGNAL_REST_API_KEY = previousApiKey;
    await prisma.$disconnect();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

describe("reminder transitions (real PostgreSQL)", () => {
  test("PENDING yields one token, PROCESSING, one attempt and a two-minute lease", async () => {
    const { reminder, token } = await claimed();
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    expect(await state(reminder.id)).toMatchObject({
      status: "PROCESSING", claimToken: token, attempts: 1,
      leaseExpiresAt: new Date(now.getTime() + leaseMs), lastError: null,
    });
    const before = await state(reminder.id);
    expect(await claimReminder(reminder.id, now)).toBeNull();
    expect(await state(reminder.id)).toEqual(before);
  });

  test("two genuinely overlapping claims yield exactly one winner", async () => {
    const reminder = await fixture();
    const blocker = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await blocker.connect();
    let claims: Promise<(string | null)[]> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query('SELECT id FROM "ReviewReminder" WHERE id = $1 FOR UPDATE', [reminder.id]);
      claims = Promise.all([claimReminder(reminder.id, now), claimReminder(reminder.id, now)]);
      // Hold the row until BOTH real UPDATE statements wait on a database lock.
      const deadline = Date.now() + 5000;
      let waiting = 0;
      do {
        // PostgreSQL caches activity snapshots inside this blocking transaction.
        await blocker.query("SELECT pg_stat_clear_snapshot()");
        const result = await blocker.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM pg_stat_activity
           WHERE application_name = $1 AND wait_event_type = 'Lock' AND state = 'active'`,
          [applicationName],
        );
        waiting = result.rows[0]!.count;
        if (waiting >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      } while (Date.now() < deadline);
      expect(waiting).toBe(2);
      await blocker.query("COMMIT");
      const results = await claims;
      const winners = results.filter((token) => token !== null);
      expect(winners).toHaveLength(1);
      expect(results.filter((token) => token === null)).toHaveLength(1);
      expect(await state(reminder.id)).toMatchObject({
        status: "PROCESSING", claimToken: winners[0], attempts: 1,
      });
    } finally {
      await blocker.query("ROLLBACK");
      await blocker.end();
      await claims;
    }
  }, 15000);

  test("stale tokens cannot mark SENT or FAILED or mutate any column", async () => {
    const { reminder } = await claimed();
    const before = await state(reminder.id);
    expect(await finishReminder(reminder.id, randomUUID(), "stale-id", now)).toBe(false);
    expect(await state(reminder.id)).toEqual(before);
    expect(await markReminderFailed(reminder.id, randomUUID(), new Error("stale"))).toBe(false);
    expect(await state(reminder.id)).toEqual(before);
  });

  test("current token marks SENT; subsequent claims and finishes are rejected", async () => {
    const { reminder, token } = await claimed();
    expect(await finishReminder(reminder.id, token, "notification-id", now)).toBe(true);
    const sent = await state(reminder.id);
    expect(sent).toMatchObject({
      status: "SENT", onesignalId: "notification-id", sentAt: now,
      claimToken: null, leaseExpiresAt: null, lastError: null, attempts: 1,
    });
    expect(await claimReminder(reminder.id, new Date(now.getTime() + retryMs))).toBeNull();
    expect(await finishReminder(reminder.id, token, "duplicate", now)).toBe(false);
    expect(await markReminderFailed(reminder.id, token, new Error("late"))).toBe(false);
    expect(await state(reminder.id)).toEqual(sent);
  });

  test("FAILED retries only after 30 minutes, including the exact boundary", async () => {
    const { reminder, token } = await claimed();
    expect(await markReminderFailed(reminder.id, token, new Error("send failed"))).toBe(true);
    const failed = await state(reminder.id);
    expect(failed).toMatchObject({
      status: "FAILED", claimToken: null, leaseExpiresAt: null,
      lastError: "Notification processing failed", attempts: 1,
    });
    // Prisma sets updatedAt using real time, independently of claimReminder(now).
    for (const elapsed of [0, retryMs - 1]) {
      expect(await claimReminder(reminder.id, new Date(failed.updatedAt.getTime() + elapsed))).toBeNull();
      expect(await state(reminder.id)).toEqual(failed);
    }
    const next = await claimReminder(reminder.id, new Date(failed.updatedAt.getTime() + retryMs));
    expect(next).toBeString();
    expect(next).not.toBe(token);
    expect(await state(reminder.id)).toMatchObject({
      status: "PROCESSING", claimToken: next, attempts: 2, lastError: null,
    });
  });

  test("third attempt is allowed; FAILED at the attempt cap is never eligible", async () => {
    const { reminder, token } = await claimed();
    let currentToken = token;
    for (let attempt = 2; attempt <= 3; attempt++) {
      expect(await markReminderFailed(reminder.id, currentToken, new Error("retry"))).toBe(true);
      const failed = await state(reminder.id);
      const next = await claimReminder(reminder.id, new Date(failed.updatedAt.getTime() + retryMs));
      assert.ok(next);
      currentToken = next;
      expect((await state(reminder.id)).attempts).toBe(attempt);
    }
    expect(await markReminderFailed(reminder.id, currentToken, new Error("exhausted"))).toBe(true);
    const before = await state(reminder.id);
    expect(await claimReminder(reminder.id, new Date(before.updatedAt.getTime() + 10 * retryMs))).toBeNull();
    expect(await state(reminder.id)).toEqual(before);
  });

  test("expired PROCESSING gets a new token and revokes both old-token finishes", async () => {
    const { reminder, token } = await claimed();
    const before = await state(reminder.id);
    // Current contract uses strictly less than: the lease is retained at equality.
    expect(await claimReminder(reminder.id, new Date(now.getTime() + leaseMs))).toBeNull();
    expect(await state(reminder.id)).toEqual(before);
    const reclaimedAt = new Date(now.getTime() + leaseMs + 1);
    const replacement = await claimReminder(reminder.id, reclaimedAt);
    assert.ok(replacement);
    expect(replacement).not.toBe(token);
    const reclaimed = await state(reminder.id);
    expect(reclaimed).toMatchObject({
      status: "PROCESSING", claimToken: replacement, attempts: 2,
      leaseExpiresAt: new Date(reclaimedAt.getTime() + leaseMs),
    });
    expect(await finishReminder(reminder.id, token, "old-id", reclaimedAt)).toBe(false);
    expect(await state(reminder.id)).toEqual(reclaimed);
    expect(await markReminderFailed(reminder.id, token, new Error("old worker"))).toBe(false);
    expect(await state(reminder.id)).toEqual(reclaimed);
    expect(await finishReminder(reminder.id, replacement, "new-id", reclaimedAt)).toBe(true);
  });

  test.each(["PENDING", "PROCESSING"] as const)("%s cannot bypass the attempt cap", async (status) => {
    const reminder = await fixture();
    await prisma.reviewReminder.update({
      where: { id: reminder.id },
      data: { status, attempts: 3, leaseExpiresAt: new Date(now.getTime() - 1) },
    });
    const before = await state(reminder.id);
    expect(await claimReminder(reminder.id, now)).toBeNull();
    expect(await state(reminder.id)).toEqual(before);
  });

  test("unknown reminder IDs cannot be claimed or finished", async () => {
    const id = randomUUID();
    expect(await claimReminder(id, now)).toBeNull();
    expect(await finishReminder(id, randomUUID(), "missing", now)).toBe(false);
    expect(await markReminderFailed(id, randomUUID(), new Error("missing"))).toBe(false);
  });

  test("claim -> simulated OneSignal send -> finish opens no Prisma transaction", async () => {
    // Keep the helper-level regression alongside the full worker tests below.
    const requestsBefore = httpCalls;
    const { reminder, token } = await claimed();
    expect(httpCalls).toBe(requestsBefore);
    process.env.ONESIGNAL_APP_ID = "test-app";
    process.env.ONESIGNAL_REST_API_KEY = "test-key";
    allowSend = true;
    let notificationId: string;
    try {
      notificationId = await sendReviewReminder(userId, reminder.dueCount, reminder.idempotencyKey);
    } finally {
      allowSend = false;
    }
    expect(await finishReminder(reminder.id, token, notificationId, now)).toBe(true);
    expect(httpCalls).toBe(requestsBefore + 1);
    const request = fetchSpy.mock.calls.at(-1)?.[1];
    expect(JSON.parse(String(request?.body)).idempotency_key).toBe(reminder.idempotencyKey);
    expect(transactionCalls).toBe(0);
    expect((await state(reminder.id)).onesignalId).toBe("simulated-onesignal-id");
  });
});

// Each worker test owns its complete fixture tree. Future schedules keep fixtures
// from other tests out of the worker's global eligibility query.
async function withDueUser(run: (id: string) => Promise<void>) {
  const id = randomUUID();
  const explanationId = randomUUID();
  const gapIds = [randomUUID(), randomUUID(), randomUUID()];
  const questionIds = [randomUUID(), randomUUID(), randomUUID()];
  await prisma.user.create({
    data: {
      id, authSubject: `worker-test-${id}`,
      explanations: {
        create: {
          id: explanationId, topic: "Notification integration test",
          knowledgeGaps: {
            create: gapIds.map((gapId, index) => ({
              id: gapId, concept: "Test concept", misconception: "Test misconception", severity: 1,
              reviewQuestion: {
                create: {
                  id: questionIds[index]!, question: "Test question?",
                  schedule: {
                    create: {
                      intervalDays: 1,
                      nextReviewAt: new Date(now.getTime() + (index === 2 ? 60_000 : -60_000)),
                    },
                  },
                },
              },
            })),
          },
        },
      },
    },
  });
  try {
    await run(id);
  } finally {
    await prisma.reviewSchedule.deleteMany({ where: { questionId: { in: questionIds } } });
    await prisma.reviewQuestion.deleteMany({ where: { id: { in: questionIds } } });
    await prisma.knowledgeGap.deleteMany({ where: { id: { in: gapIds } } });
    await prisma.explanation.deleteMany({ where: { id: explanationId } });
    await prisma.user.deleteMany({ where: { id } });
  }
}

async function userReminder(id: string) {
  return prisma.reviewReminder.findUniqueOrThrow({
    where: { userId_reminderDate: { userId: id, reminderDate: new Date("2026-10-26T00:00:00Z") } },
  });
}

describe("full reminder worker (real PostgreSQL, mocked sends)", () => {
  test.each([
    [new Error("Authorization: Key secret-api-key; postgres://user:private@db/app"), "Notification processing failed"],
    [{ message: "secret-api-key", headers: { authorization: "private" } }, "Notification processing failed"],
    [undefined, "Notification processing failed"],
    [new Error("OneSignal HTTP 500"), "OneSignal HTTP 500"],
  ] as const)("failure %# clears the claim and lease and persists/logs only safe errors", async (error, safeMessage) => {
    await withDueUser(async (id) => {
      const log = spyOn(console, "error").mockImplementation(() => {});
      let sends = 0;
      try {
        const summary = await sendDueReviewReminders(now, {
          send: async () => {
            sends++;
            const processing = await userReminder(id);
            expect(processing.status).toBe("PROCESSING");
            expect(processing.claimToken).toBeString();
            expect(processing.leaseExpiresAt).toBeInstanceOf(Date);
            throw error;
          },
        });
        expect(summary).toEqual({ eligible: 1, accepted: 0, skipped: 0, failed: 1 });
        const failed = await userReminder(id);
        expect(failed).toMatchObject({
          status: "FAILED", claimToken: null, leaseExpiresAt: null,
          attempts: 1, lastError: safeMessage, sentAt: null, onesignalId: null,
        });
        expect(log).toHaveBeenCalledWith("Reminder processing failed", { reminderId: failed.id, reason: safeMessage });
        for (const secret of ["secret-api-key", "Authorization", "private", "postgres://"]) {
          expect(JSON.stringify(failed)).not.toContain(secret);
          expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
        }
        // The worker must honor the cooldown, not just the claim helper.
        expect(await sendDueReviewReminders(now, {
          send: async () => { sends++; return "must-not-send"; },
        })).toEqual({ eligible: 1, accepted: 0, skipped: 1, failed: 0 });
        expect(sends).toBe(1);
        expect(await userReminder(id)).toEqual(failed);
      } finally {
        log.mockRestore();
      }
    });
  });

  test("success uses the persisted key and never resends a SENT reminder", async () => {
    await withDueUser(async (id) => {
      const existing = await createReminder(id, 2, now);
      const keys: string[] = [];
      const send = async (user: string, count: number, key: string) => {
        expect(user).toBe(id);
        expect(count).toBe(2);
        keys.push(key);
        return "worker-notification-id";
      };
      expect(await sendDueReviewReminders(now, { send })).toEqual({ eligible: 1, accepted: 1, skipped: 0, failed: 0 });
      expect(keys).toEqual([existing.idempotencyKey]);
      const sent = await userReminder(id);
      expect(sent).toMatchObject({
        id: existing.id, idempotencyKey: existing.idempotencyKey,
        status: "SENT", attempts: 1, onesignalId: "worker-notification-id",
        claimToken: null, leaseExpiresAt: null, lastError: null,
      });
      expect(sent.sentAt).toBeInstanceOf(Date);
      expect(await sendDueReviewReminders(now, { send })).toEqual({ eligible: 1, accepted: 0, skipped: 1, failed: 0 });
      expect(keys).toHaveLength(1);
      expect(await userReminder(id)).toEqual(sent);
    });
  });

  test("a retry after cooldown reuses the persisted idempotency key", async () => {
    await withDueUser(async (id) => {
      const log = spyOn(console, "error").mockImplementation(() => {});
      const keys: string[] = [];
      try {
        await sendDueReviewReminders(now, {
          send: async (_user, _count, key) => { keys.push(key); throw new Error("OneSignal HTTP 503"); },
        });
        const failed = await userReminder(id);
        // Age only this fixture; no wall-clock waiting or production writes.
        await prisma.reviewReminder.update({
          where: { id: failed.id }, data: { updatedAt: new Date(Date.now() - retryMs - 1000) },
        });
        expect(await sendDueReviewReminders(now, {
          send: async (_user, _count, key) => { keys.push(key); return "retry-notification-id"; },
        })).toEqual({ eligible: 1, accepted: 1, skipped: 0, failed: 0 });
        expect(keys).toEqual([failed.idempotencyKey, failed.idempotencyKey]);
        expect(await userReminder(id)).toMatchObject({
          status: "SENT", attempts: 2, lastError: null, claimToken: null, leaseExpiresAt: null,
        });
      } finally {
        log.mockRestore();
      }
    });
  });

  test("dry-run before 16:00 reads eligibility, makes zero writes and zero sends", async () => {
    await withDueUser(async (id) => {
      await createReminder(id, 2, now);
      const before = await prisma.reviewReminder.findMany({ orderBy: { id: "asc" } });
      const callsBefore = httpCalls;
      const log = spyOn(console, "info").mockImplementation(() => {});
      const summaryLog = spyOn(console, "log").mockImplementation(() => {});
      const upsert = spyOn(prisma.reviewReminder, "upsert").mockImplementation(() => { throw new Error("Dry-run attempted a write"); });
      const update = spyOn(prisma.reviewReminder, "updateMany").mockImplementation(() => { throw new Error("Dry-run attempted a write"); });
      let sends = 0;
      let disconnects = 0;
      try {
        expect(await runReminderJob({
          run: (timestamp, options) => sendDueReviewReminders(timestamp, {
            ...options, send: async () => { sends++; throw new Error("Dry-run attempted a send"); },
          }),
          disconnect: async () => { disconnects++; },
        }, { now, env: { NOTIFICATION_DRY_RUN: "true" } })).toBe(0);
        expect(log).toHaveBeenCalledWith("[DRY RUN] Would send reminder", { userId: id, dueCount: 2 });
        expect(summaryLog).toHaveBeenCalledWith("Reminder job summary", { eligible: 1, accepted: 0, skipped: 1, failed: 0 });
        expect(upsert).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(sends).toBe(0);
        expect(httpCalls).toBe(callsBefore);
        expect(disconnects).toBe(1);
        expect(await prisma.reviewReminder.findMany({ orderBy: { id: "asc" } })).toEqual(before);
      } finally {
        upsert.mockRestore();
        update.mockRestore();
        log.mockRestore();
        summaryLog.mockRestore();
      }
    });
  });

  test("overlapping workers create one reminder and send exactly once", async () => {
    await withDueUser(async (id) => {
      let releaseSend!: () => void;
      let startedSend!: () => void;
      const heldSend = new Promise<void>((resolve) => { releaseSend = resolve; });
      const started = new Promise<void>((resolve) => { startedSend = resolve; });
      const keys: string[] = [];
      const send = async (_user: string, _count: number, key: string) => {
        keys.push(key);
        startedSend();
        await heldSend;
        return "concurrent-notification-id";
      };
      // Start both workers before any reminder exists; retain the winning
      // worker's HTTP request while the other worker tries to claim the row.
      const workers = [sendDueReviewReminders(now, { send }), sendDueReviewReminders(now, { send })];
      // A broken claim must fail assertions rather than leave both sends hung.
      const timeout = setTimeout(releaseSend, 5000);
      try {
        await Promise.race([started, Promise.all(workers).then(() => { throw new Error("No worker reached send"); })]);
        const loser = await Promise.race(workers);
        expect(loser).toEqual({ eligible: 1, accepted: 0, skipped: 1, failed: 0 });
        expect(keys).toHaveLength(1);
        const processing = await userReminder(id);
        expect(processing).toMatchObject({ status: "PROCESSING", attempts: 1 });
        expect(keys).toEqual([processing.idempotencyKey]);
      } finally {
        clearTimeout(timeout);
        releaseSend();
        await Promise.all(workers);
      }
      const results = await Promise.all(workers);
      expect(results.reduce((sum, result) => sum + result.accepted, 0)).toBe(1);
      expect(keys).toHaveLength(1);
      expect(await prisma.reviewReminder.count({ where: { userId: id } })).toBe(1);
      expect(await userReminder(id)).toMatchObject({ status: "SENT", attempts: 1 });
    });
  }, 15000);

  test("scheduler CLI dry-run succeeds on a read-only connection with zero HTTP calls", async () => {
    await withDueUser(async (id) => {
      // The CLI uses the actual clock, so make only this fixture due relative to it.
      await prisma.reviewSchedule.updateMany({
        where: { question: { knowledgeGap: { explanation: { userId: id } } } },
        data: { nextReviewAt: new Date(Date.now() - 60_000) },
      });
      const readOnlyUrl = new URL(databaseUrl);
      readOnlyUrl.searchParams.set("options", "-c default_transaction_read_only=on");
      const before = await prisma.reviewReminder.findMany({ orderBy: { id: "asc" } });
      const child = Bun.spawn([
        process.execPath, "--preload", "./test-support/block-http.ts", "./run-due-review-reminders.ts",
      ], {
        cwd: import.meta.dir,
        env: {
          ...process.env,
          DATABASE_URL: readOnlyUrl.toString(),
          NOTIFICATION_DRY_RUN: "true",
          GITHUB_ACTIONS: "true",
          ONESIGNAL_APP_ID: "test-app",
          ONESIGNAL_REST_API_KEY: "test-key",
        },
        stdout: "pipe", stderr: "pipe",
      });
      const timeout = setTimeout(() => child.kill(), 10_000);
      try {
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
        ]);
        expect(stderr).toBe("");
        expect(exitCode).toBe(0);
        expect(stdout).toContain("[DRY RUN] Would send reminder");
        expect(stdout).toContain(id);
        expect(stdout).toContain("eligible: 1");
        expect(stdout).toContain("accepted: 0");
        expect(stdout).toContain("failed: 0");
        expect(stdout).toContain("Test HTTP calls 0");
        expect(await prisma.reviewReminder.findMany({ orderBy: { id: "asc" } })).toEqual(before);
      } finally {
        clearTimeout(timeout);
        child.kill();
        await child.exited;
      }
    });
  }, 15000);
});
