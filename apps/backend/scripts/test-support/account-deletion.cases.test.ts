import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import express, {
  type NextFunction,
  type Request as Req,
  type Response as Res,
} from "express";
import type { Server } from "node:http";

// DELETE /api/v1/me against spec §16.1, as seen from outside the route:
// call order, HTTP status, error body and logging. No database, Clerk, RevenueCat or OneSignal:
// Prisma is an in-memory fake, Clerk is mocked and fetch is stubbed.
// Run: bun test scripts/account-deletion.test.ts

const USER_ID = "user-1"; // internal User.id = RevenueCat app_user_id = OneSignal external_id
const CLERK_ID = "user_clerk_1"; // User.authSubject
const ONESIGNAL_APP_ID = "test-onesignal-app";

// Every side effect, in order, e.g. ["revenuecat:user-1", "onesignal:user-1", "db:user-1", "clerk:user_clerk_1"].
let events: string[];
// User rows that still exist in the fake DB.
let users: Set<string>;
let dbError: Error | null;
let clerkError: Error | null;
let revenueCatResponse: () => Response;
let oneSignalResponse: () => Response;
let revenueCatCalls: { url: string; init?: RequestInit }[];
let oneSignalCalls: { url: string; init?: RequestInit }[];

/** Both delete styles, so the test does not depend on which one the code uses. */
function deleteUserRow(id: string) {
  events.push(`db:${id}`);
  if (dbError) throw dbError;
  return users.delete(id);
}

mock.module("../../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      deleteMany: async ({ where }: { where: { id: string } }) => ({
        count: deleteUserRow(where.id) ? 1 : 0,
      }),
      delete: async ({ where }: { where: { id: string } }) => {
        if (!deleteUserRow(where.id)) {
          throw Object.assign(new Error("Record to delete does not exist."), {
            code: "P2025",
          });
        }
        return { id: where.id };
      },
    },
  },
}));

// Signed in; requireUser has already resolved the internal User row.
mock.module("../../src/middleware/requireUser.js", () => ({
  requireUser: (req: Req, _res: Res, next: NextFunction) => {
    req.user = { id: USER_ID, authSubject: CLERK_ID } as Req["user"];
    next();
  },
}));

mock.module("@clerk/express", () => ({
  clerkMiddleware: () => (_req: Req, _res: Res, next: NextFunction) => next(),
  getAuth: () => ({ isAuthenticated: true, userId: CLERK_ID }),
  clerkClient: {
    users: {
      deleteUser: async (id: string) => {
        events.push(`clerk:${id}`);
        if (clerkError) throw clerkError;
        return { id, deleted: true };
      },
    },
  },
}));

/** Clerk's SDK throws errors that carry the HTTP status. */
function clerkHttpError(status: number) {
  return Object.assign(new Error(`Clerk HTTP ${status}`), { status });
}

const previousEnv = {
  revenueCatKey: process.env.REVENUECAT_SECRET_API_KEY,
  oneSignalAppId: process.env.ONESIGNAL_APP_ID,
  oneSignalKey: process.env.ONESIGNAL_REST_API_KEY,
};
process.env.REVENUECAT_SECRET_API_KEY = "test-revenuecat-secret";
process.env.ONESIGNAL_APP_ID = ONESIGNAL_APP_ID;
process.env.ONESIGNAL_REST_API_KEY = "test-onesignal-key";

const { default: meRoutes } = await import(
  "../../src/features/me/routes/me.routes.js"
);
const { deleteAccountData } = await import(
  "../../src/features/me/deleteAccount.js"
);
const { AppError, sendError } = await import("../../src/lib/errors.js");

const realFetch = globalThis.fetch;
let server: Server;
let baseUrl: string;
let consoleErrors: unknown[][];

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/me", meRoutes);
  // Same mapping as the error handler in src/app.ts
  app.use((err: unknown, _req: Req, res: Res, _next: NextFunction) => {
    console.error(err);
    if (err instanceof AppError) return sendError(res, err.code);
    sendError(res, "INTERNAL_ERROR");
  });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  // Stubs only RevenueCat and OneSignal; requests to the test server go through.
  globalThis.fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith("https://api.revenuecat.com/")) {
        revenueCatCalls.push({ url, init });
        events.push(`revenuecat:${decodeURIComponent(url.split("/").at(-1)!)}`);
        return revenueCatResponse();
      }
      if (url.startsWith("https://api.onesignal.com/")) {
        oneSignalCalls.push({ url, init });
        events.push(`onesignal:${decodeURIComponent(url.split("/").at(-1)!)}`);
        return oneSignalResponse();
      }
      return realFetch(input, init);
    },
    { preconnect: realFetch.preconnect },
  ) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
  server.close();
  process.env.REVENUECAT_SECRET_API_KEY = previousEnv.revenueCatKey;
  process.env.ONESIGNAL_APP_ID = previousEnv.oneSignalAppId;
  process.env.ONESIGNAL_REST_API_KEY = previousEnv.oneSignalKey;
});

beforeEach(() => {
  events = [];
  users = new Set([USER_ID]);
  dbError = null;
  clerkError = null;
  revenueCatResponse = () => Response.json({}, { status: 200 });
  oneSignalResponse = () => Response.json({}, { status: 200 });
  revenueCatCalls = [];
  oneSignalCalls = [];
  consoleErrors = [];
  spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    consoleErrors.push(args);
  });
});

/** A hanging handler (no response sent) fails here instead of timing out the whole run. */
async function deleteMe() {
  const res = await realFetch(`${baseUrl}/api/v1/me`, {
    method: "DELETE",
    signal: AbortSignal.timeout(2_000),
  });
  return { status: res.status, body: await res.text() };
}

function expectDeletionFailed(result: { status: number; body: string }) {
  expect(result.status).toBe(502);
  expect(JSON.parse(result.body)).toEqual({
    error: {
      code: "ACCOUNT_DELETION_FAILED",
      message: "Could not delete your account.",
    },
  });
}

/** §16.1: the details of a failure are logged (the original error, not only "it failed"). */
function expectLogged(original: Error) {
  const logged = consoleErrors.flat().some(
    (arg) =>
      arg === original ||
      (arg instanceof Error &&
        (arg.message.includes(original.message) || arg.cause === original)) ||
      (typeof arg === "string" && arg.includes(original.message)),
  );
  expect(logged).toBe(true);
}

const fullOrder = [
  `revenuecat:${USER_ID}`,
  `onesignal:${USER_ID}`,
  `db:${USER_ID}`,
  `clerk:${CLERK_ID}`,
];

describe("DELETE /api/v1/me: success (§16.1)", () => {
  test("deletes RevenueCat → OneSignal → DB → Clerk and returns 204 with no body", async () => {
    const result = await deleteMe();

    expect(result.status).toBe(204);
    expect(result.body).toBe("");
    expect(events).toEqual(fullOrder);
    expect(users.has(USER_ID)).toBe(false);
  });

  test("calls the RevenueCat and OneSignal delete endpoints with their keys", async () => {
    await deleteMe();

    expect(revenueCatCalls).toHaveLength(1);
    expect(revenueCatCalls[0]!.url).toBe(
      `https://api.revenuecat.com/v1/subscribers/${USER_ID}`,
    );
    expect(revenueCatCalls[0]!.init?.method).toBe("DELETE");
    expect(
      new Headers(revenueCatCalls[0]!.init?.headers).get("Authorization"),
    ).toBe("Bearer test-revenuecat-secret");

    expect(oneSignalCalls).toHaveLength(1);
    expect(oneSignalCalls[0]!.url).toBe(
      `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${USER_ID}`,
    );
    expect(oneSignalCalls[0]!.init?.method).toBe("DELETE");
    expect(
      new Headers(oneSignalCalls[0]!.init?.headers).get("Authorization"),
    ).toBe("Key test-onesignal-key");
  });
});

describe("DELETE /api/v1/me: already deleted counts as success (§16.1, idempotent)", () => {
  test("RevenueCat 404", async () => {
    revenueCatResponse = () => Response.json({}, { status: 404 });
    const result = await deleteMe();
    expect(result.status).toBe(204);
    expect(events).toEqual(fullOrder);
  });

  test("OneSignal 404", async () => {
    oneSignalResponse = () => Response.json({}, { status: 404 });
    const result = await deleteMe();
    expect(result.status).toBe(204);
    expect(events).toEqual(fullOrder);
  });

  test("Clerk 404", async () => {
    clerkError = clerkHttpError(404);
    const result = await deleteMe();
    expect(result.status).toBe(204);
    expect(result.body).toBe("");
  });

  test("the User row is already gone", async () => {
    users.clear();
    const result = await deleteMe();
    expect(result.status).toBe(204);
    expect(events).toEqual(fullOrder);
  });

  test("everything already gone (a retry after a full deletion)", async () => {
    revenueCatResponse = () => Response.json({}, { status: 404 });
    oneSignalResponse = () => Response.json({}, { status: 404 });
    users.clear();
    clerkError = clerkHttpError(404);
    const result = await deleteMe();
    expect(result.status).toBe(204);
  });
});

describe("DELETE /api/v1/me: a failure stops the later steps and returns 502 (§16.1)", () => {
  test("RevenueCat 500: nothing else is deleted", async () => {
    revenueCatResponse = () => Response.json({}, { status: 500 });
    const result = await deleteMe();
    expectDeletionFailed(result);
    expect(events).toEqual([`revenuecat:${USER_ID}`]);
    expect(users.has(USER_ID)).toBe(true);
  });

  test("RevenueCat network error", async () => {
    revenueCatResponse = () => {
      throw new TypeError("fetch failed");
    };
    const result = await deleteMe();
    expectDeletionFailed(result);
    expect(users.has(USER_ID)).toBe(true);
  });

  test("OneSignal 500: the DB row and the Clerk user stay", async () => {
    oneSignalResponse = () => Response.json({}, { status: 500 });
    const result = await deleteMe();
    expectDeletionFailed(result);
    expect(events).toEqual([`revenuecat:${USER_ID}`, `onesignal:${USER_ID}`]);
    expect(users.has(USER_ID)).toBe(true);
  });

  test("DB error: the Clerk user stays, and the error is logged", async () => {
    dbError = new Error("connection terminated unexpectedly");
    const result = await deleteMe();
    expectDeletionFailed(result);
    expect(events).not.toContain(`clerk:${CLERK_ID}`);
    expectLogged(dbError);
  });

  test("Clerk 500: the data is already gone, and the error is logged", async () => {
    clerkError = clerkHttpError(500);
    const result = await deleteMe();
    expectDeletionFailed(result);
    expect(events).toEqual(fullOrder);
    expect(users.has(USER_ID)).toBe(false);
    expectLogged(clerkError);
  });

  test("a retry after a Clerk failure finishes the deletion", async () => {
    clerkError = clerkHttpError(500);
    expectDeletionFailed(await deleteMe());

    // Second attempt: RevenueCat/OneSignal/DB already gone, Clerk recovers.
    clerkError = null;
    revenueCatResponse = () => Response.json({}, { status: 404 });
    oneSignalResponse = () => Response.json({}, { status: 404 });
    const result = await deleteMe();
    expect(result.status).toBe(204);
  });
});

describe("deleteAccountData (shared with the Clerk webhook, §16.4)", () => {
  test("deletes RevenueCat → OneSignal → DB and never touches Clerk", async () => {
    await deleteAccountData(USER_ID);
    expect(events).toEqual([
      `revenuecat:${USER_ID}`,
      `onesignal:${USER_ID}`,
      `db:${USER_ID}`,
    ]);
  });

  test("resolves when the User row is already gone (webhook after an in-app deletion)", async () => {
    users.clear();
    await deleteAccountData(USER_ID);
    expect(events).not.toContain(`clerk:${CLERK_ID}`);
  });
});
