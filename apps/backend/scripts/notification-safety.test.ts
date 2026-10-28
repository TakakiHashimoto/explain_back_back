import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { getSafeErrorMessage } from "../src/lib/getSafeErrorMsg.js";
import { sendReviewReminder } from "../src/features/review/notifications/sendReviewReminder.js";
import { runReminderJob } from "./run-due-review-reminders.js";
import { getTestDatabaseUrl } from "./test-database.js";

const secret = "Authorization: Key secret-api-key; password=private-db-password";
const appId = process.env.ONESIGNAL_APP_ID;
const apiKey = process.env.ONESIGNAL_REST_API_KEY;

afterEach(() => {
  mock.restore();
  if (appId === undefined) delete process.env.ONESIGNAL_APP_ID;
  else process.env.ONESIGNAL_APP_ID = appId;
  if (apiKey === undefined) delete process.env.ONESIGNAL_REST_API_KEY;
  else process.env.ONESIGNAL_REST_API_KEY = apiKey;
});

describe("notification error safety", () => {
  test.each([400, 401, 429, 500, 503, 599])("HTTP %i preserves only the allowlisted status", async (status) => {
    process.env.ONESIGNAL_APP_ID = "test-app";
    process.env.ONESIGNAL_REST_API_KEY = "secret-api-key";
    const response = new Response(secret, { status });
    const readBody = spyOn(response, "text");
    const readJson = spyOn(response, "json");
    const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(response);
    let caught: unknown;
    try {
      await sendReviewReminder("test-user", 2, "persisted-key");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(`OneSignal HTTP ${status}`);
    expect(getSafeErrorMessage(caught)).toBe(`OneSignal HTTP ${status}`);
    expect(readBody).not.toHaveBeenCalled();
    expect(readJson).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([
    new Error(secret), new Error(`OneSignal HTTP 500 ${secret}`),
    new Error(`OneSignal HTTP 500\n${secret}`), new Error("OneSignal HTTP 500\n"),
    new Error("OneSignal HTTP 200"), new Error("OneSignal HTTP 999"),
    new Error("OneSignal request failed with status 500"),
    secret, { message: secret }, null, undefined, 42,
  ])("unknown or non-allowlisted error %# is generic", (error) => {
    expect(getSafeErrorMessage(error)).toBe("Notification processing failed");
  });

  test.each(["TimeoutError", "AbortError"])("%s is safe even with secret details", (name) => {
    const error = new Error(secret);
    error.name = name;
    expect(getSafeErrorMessage(error)).toBe("Notification request timed out");
  });
});

describe("scheduler", () => {
  const summary = { eligible: 1, accepted: 0, skipped: 1, failed: 0 };
  function dependencies() {
    spyOn(console, "log").mockImplementation(() => {});
    spyOn(console, "error").mockImplementation(() => {});
    return {
      run: mock(async () => ({ ...summary })),
      disconnect: mock(async () => {}),
    };
  }

  test("explicit dry-run checks the database before 16:00 UTC", async () => {
    const deps = dependencies();
    const now = new Date("2026-10-27T03:00:00Z");
    expect(await runReminderJob(deps, { now, env: { NOTIFICATION_DRY_RUN: "true" } })).toBe(0);
    expect(deps.run).toHaveBeenCalledWith(now, { dryRun: true });
    expect(deps.disconnect).toHaveBeenCalledTimes(1);
  });

  test.each([undefined, "false", "TRUE", "1"])("live mode never bypasses the window with flag %s", async (flag) => {
    const deps = dependencies();
    expect(await runReminderJob(deps, {
      now: new Date("2026-10-27T15:59:59Z"), env: { NOTIFICATION_DRY_RUN: flag },
    })).toBe(0);
    expect(deps.run).not.toHaveBeenCalled();
    expect(deps.disconnect).toHaveBeenCalledTimes(1);
  });

  test("live mode is allowed exactly at 16:00 UTC", async () => {
    const deps = dependencies();
    const now = new Date("2026-10-27T16:00:00Z");
    expect(await runReminderJob(deps, { now, env: { NOTIFICATION_DRY_RUN: "false" } })).toBe(0);
    expect(deps.run).toHaveBeenCalledWith(now, { dryRun: false });
  });

  test.each([undefined, "true", "invalid"])("GitHub Actions defaults to dry-run with flag %s", async (flag) => {
    const deps = dependencies();
    const now = new Date("2026-10-27T16:00:00Z");
    expect(await runReminderJob(deps, { now, env: { GITHUB_ACTIONS: "true", NOTIFICATION_DRY_RUN: flag } })).toBe(0);
    expect(deps.run).toHaveBeenCalledWith(now, { dryRun: true });
  });

  test("explicit Actions live mode still respects the window", async () => {
    const deps = dependencies();
    expect(await runReminderJob(deps, {
      now: new Date("2026-10-27T03:00:00Z"), env: { GITHUB_ACTIONS: "true", NOTIFICATION_DRY_RUN: "false" },
    })).toBe(0);
    expect(deps.run).not.toHaveBeenCalled();
  });

  test.each([new Error(secret), { message: secret }, null])("top-level failure %# is sanitized and exits nonzero", async (error) => {
    const deps = dependencies();
    deps.run.mockRejectedValue(error);
    expect(await runReminderJob(deps, { env: { NOTIFICATION_DRY_RUN: "true" } })).toBe(1);
    expect(console.error).toHaveBeenCalledWith("Reminder job failed", "Notification processing failed");
    expect(JSON.stringify((console.error as ReturnType<typeof mock>).mock.calls)).not.toContain(secret);
    expect(deps.disconnect).toHaveBeenCalledTimes(1);
  });

  test("worker failures preserve a nonzero exit", async () => {
    const deps = dependencies();
    deps.run.mockResolvedValue({ ...summary, failed: 1 });
    expect(await runReminderJob(deps, { env: { NOTIFICATION_DRY_RUN: "true" } })).toBe(1);
  });

  test("disconnect failure is sanitized and exits nonzero", async () => {
    const deps = dependencies();
    deps.disconnect.mockRejectedValue(new Error(secret));
    expect(await runReminderJob(deps, { env: { NOTIFICATION_DRY_RUN: "true" } })).toBe(1);
    expect(console.error).toHaveBeenCalledWith("Reminder job disconnect failed", "Notification processing failed");
  });
});

describe("test database guard", () => {
  test("missing test URL never falls back to DATABASE_URL", () => {
    expect(() => getTestDatabaseUrl({ DATABASE_URL: "postgresql://localhost/production" })).toThrow("Set TEST_DATABASE_URL");
  });
  test("the application database is rejected even with different credentials or query parameters", () => {
    expect(() => getTestDatabaseUrl({
      DATABASE_URL: "postgresql://app:private@localhost/production?sslmode=require",
      TEST_DATABASE_URL: "postgres://test:secret@127.0.0.1:5432/production?application_name=test",
    })).toThrow("must be separate");
  });
  test.each([`invalid-${secret}`, "https://localhost/test", "postgresql://localhost"])("invalid URL %# is rejected without echoing secrets", (url) => {
    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: url })).toThrow("Test database configuration must be a valid PostgreSQL URL");
  });
  test("explicit separate test database is accepted", () => {
    expect(getTestDatabaseUrl({ TEST_DATABASE_URL: "postgresql://localhost/test", DATABASE_URL: "postgresql://localhost/app" })).toBe("postgresql://localhost/test");
  });
});
