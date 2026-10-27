import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { Client } from "pg";

// Run against a migrated, disposable PostgreSQL database:
// TEST_DATABASE_URL=postgresql://... bun run test:reminders
// No fallback to the application's DATABASE_URL; no real HTTP requests.
assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL to a test database");
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
const applicationName = `reminder-test-${randomUUID()}`;
databaseUrl.searchParams.set("application_name", applicationName);
process.env.DATABASE_URL = databaseUrl.toString();

// The service client must be imported after selecting the test database.
const { prisma } = await import("../src/lib/prisma.js");
const { claimReminder } = await import("../src/features/review/notifications/claimReminder.js");
const { finishReminder, markReminderFailed } = await import("../src/features/review/notifications/finishReminder.js");
const { sendReviewReminder } = await import("../src/features/review/notifications/sendReviewReminder.js");

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
      lastError: "send failed", attempts: 1,
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
    // This exercises the existing helpers, not a production dispatcher (none exists yet).
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
    expect(transactionCalls).toBe(0);
    expect((await state(reminder.id)).onesignalId).toBe("simulated-onesignal-id");
  });
});
