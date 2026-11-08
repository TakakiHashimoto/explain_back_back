import {
  afterAll,
  afterEach,
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

// No database and no RevenueCat: Prisma is an in-memory fake and fetch is stubbed.
// Run: bun test scripts/revenuecat.test.ts
type Row = { userId: string; expiresAt: Date | null; source: string };
let rows: Map<string, Row>;
// Existing User.id values (webhook lookups).
let userIds: Set<string>;
// Order of User row locks and RevenueCat calls, e.g. ["lock:user-1", "revenuecat:user-1"].
let events: string[];

const fakeEntitlement = {
  findUnique: async ({ where }: { where: { userId: string } }) =>
    rows.get(where.userId) ?? null,
  deleteMany: async ({
    where,
  }: {
    where: { userId: string; source: string };
  }) => {
    const row = rows.get(where.userId);
    if (row && row.source === where.source) rows.delete(where.userId);
  },
  upsert: async ({
    where,
    create,
    update,
  }: {
    where: { userId: string };
    create: Row;
    update: Partial<Row>;
  }) => {
    const row = rows.get(where.userId);
    rows.set(where.userId, row ? { ...row, ...update } : create);
  },
};

mock.module("../../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => userIds.has(id)).map((id) => ({ id })),
    },
    entitlement: fakeEntitlement,
    // No real isolation: the tests only check that the lock comes before the RevenueCat call.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: async (_sql: TemplateStringsArray, userId: string) => {
          events.push(`lock:${userId}`);
          return [];
        },
        entitlement: fakeEntitlement,
      }),
  },
}));

// Signed in as "user-1" (no Clerk).
mock.module("../../src/middleware/require-user.js", () => ({
  requireUser: (req: Req, _res: Res, next: NextFunction) => {
    req.user = { id: "user-1" } as Req["user"];
    next();
  },
}));

// getUsage reads the window from the DB; here it only reports the plan the sync left behind.
mock.module("../../src/features/usage/usage.service.js", () => ({
  getUsage: async (userId: string, now: Date) => {
    const row = rows.get(userId);
    return {
      isPro: !!row && (row.expiresAt === null || row.expiresAt > now),
    };
  },
}));

const { syncEntitlementFromRevenueCat } = await import(
  "../../src/features/usage/entitlement/syncEntitlement.js"
);
const { default: usageRoutes, clearRefreshCooldowns } = await import(
  "../../src/features/usage/routes/usage.routes.js"
);
const {
  default: webhookRoutes,
  getAppUserIds,
  isAuthorized,
} = await import("../../src/features/usage/routes/webhook.routes.js");
const { AppError, sendError } = await import("../../src/lib/errors.js");

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/webhooks", webhookRoutes);
  app.use("/api/v1/me", usageRoutes);
  // Same mapping as the error handler in src/app.ts
  app.use((err: unknown, _req: Req, res: Res, _next: NextFunction) => {
    if (err instanceof AppError) return sendError(res, err.code);
    sendError(res, "INTERNAL_ERROR");
  });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(() => {
  server.close();
});

const realFetch = globalThis.fetch;
const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
const webhookAuth = process.env.REVENUECAT_WEBHOOK_AUTH;
let revenueCatCalls: { url: string; init?: RequestInit }[];
let subscriber: (userId: string) => Response;

/** Stubs only RevenueCat; other requests (the test server) go through. */
function stubRevenueCat() {
  globalThis.fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.startsWith("https://api.revenuecat.com/")) {
        return realFetch(input, init);
      }
      revenueCatCalls.push({ url, init });
      const userId = decodeURIComponent(url.split("/").at(-1)!);
      events.push(`revenuecat:${userId}`);
      return subscriber(userId);
    },
    { preconnect: realFetch.preconnect },
  ) as typeof fetch;
}

/** A REST API v1 subscriber body with the given entitlements. */
function subscriberWith(entitlements: Record<string, unknown>) {
  return Response.json({ subscriber: { entitlements } });
}

beforeEach(() => {
  rows = new Map();
  userIds = new Set(["user-1", "user-2"]);
  revenueCatCalls = [];
  events = [];
  clearRefreshCooldowns();
  subscriber = () => subscriberWith({});
  process.env.REVENUECAT_SECRET_API_KEY = "sk_test_secret";
  process.env.REVENUECAT_WEBHOOK_AUTH = "Bearer webhook-secret";
  stubRevenueCat();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (apiKey === undefined) delete process.env.REVENUECAT_SECRET_API_KEY;
  else process.env.REVENUECAT_SECRET_API_KEY = apiKey;
  if (webhookAuth === undefined) delete process.env.REVENUECAT_WEBHOOK_AUTH;
  else process.env.REVENUECAT_WEBHOOK_AUTH = webhookAuth;
});

describe("syncEntitlementFromRevenueCat", () => {
  test("calls GET /v1/subscribers/{id} with the secret key and no X-Platform", async () => {
    await syncEntitlementFromRevenueCat("user/1");

    expect(revenueCatCalls).toHaveLength(1);
    const { url, init } = revenueCatCalls[0]!;
    expect(url).toBe("https://api.revenuecat.com/v1/subscribers/user%2F1");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer sk_test_secret");
    expect(headers.has("X-Platform")).toBe(false);
  });

  test("creates a revenuecat row from an active subscription", async () => {
    subscriber = () =>
      subscriberWith({
        pro: { expires_date: "2030-01-01T00:00:00Z", product_identifier: "x" },
      });

    await syncEntitlementFromRevenueCat("user-1");

    expect(rows.get("user-1")).toEqual({
      userId: "user-1",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
      source: "revenuecat",
    });
  });

  test("null expires_date is stored as a non-expiring entitlement", async () => {
    subscriber = () => subscriberWith({ pro: { expires_date: null } });

    await syncEntitlementFromRevenueCat("user-1");

    expect(rows.get("user-1")?.expiresAt).toBeNull();
  });

  test("a later grace period end extends expiresAt", async () => {
    subscriber = () =>
      subscriberWith({
        pro: {
          expires_date: "2030-01-01T00:00:00Z",
          grace_period_expires_date: "2030-01-08T00:00:00Z",
        },
      });

    await syncEntitlementFromRevenueCat("user-1");

    expect(rows.get("user-1")?.expiresAt).toEqual(
      new Date("2030-01-08T00:00:00Z"),
    );
  });

  test("an expired entitlement keeps its past expiresAt (getPlan reads it as Free)", async () => {
    rows.set("user-1", {
      userId: "user-1",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
      source: "revenuecat",
    });
    subscriber = () =>
      subscriberWith({ pro: { expires_date: "2020-01-01T00:00:00Z" } });

    await syncEntitlementFromRevenueCat("user-1");

    expect(rows.get("user-1")?.expiresAt).toEqual(
      new Date("2020-01-01T00:00:00Z"),
    );
  });

  test("no pro entitlement deletes the revenuecat row; other entitlements are ignored", async () => {
    rows.set("user-1", {
      userId: "user-1",
      expiresAt: null,
      source: "revenuecat",
    });
    subscriber = () => subscriberWith({ other: { expires_date: null } });

    await syncEntitlementFromRevenueCat("user-1");

    expect(rows.has("user-1")).toBe(false);
  });

  test("an active row from another source is never changed", async () => {
    const manual = { userId: "user-1", expiresAt: null, source: "manual" };
    rows.set("user-1", manual);

    await syncEntitlementFromRevenueCat("user-1");

    expect(rows.get("user-1")).toEqual(manual);
  });

  test("an active, expiring row from another source is not shortened", async () => {
    const promo = {
      userId: "user-1",
      expiresAt: new Date("2099-01-01T00:00:00Z"),
      source: "manual",
    };
    rows.set("user-1", promo);
    subscriber = () =>
      subscriberWith({ pro: { expires_date: "2030-01-01T00:00:00Z" } });

    await syncEntitlementFromRevenueCat("user-1");

    expect(rows.get("user-1")).toEqual(promo);
  });

  test("an expired row from another source is taken over by a RevenueCat purchase", async () => {
    rows.set("user-1", {
      userId: "user-1",
      expiresAt: new Date("2020-01-01T00:00:00Z"),
      source: "manual",
    });
    subscriber = () =>
      subscriberWith({ pro: { expires_date: "2030-01-01T00:00:00Z" } });

    await syncEntitlementFromRevenueCat("user-1");

    expect(rows.get("user-1")).toEqual({
      userId: "user-1",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
      source: "revenuecat",
    });
  });

  test("an expired row from another source is kept when RevenueCat has no pro", async () => {
    const manual = {
      userId: "user-1",
      expiresAt: new Date("2020-01-01T00:00:00Z"),
      source: "manual",
    };
    rows.set("user-1", manual);

    await syncEntitlementFromRevenueCat("user-1");

    expect(rows.get("user-1")).toEqual(manual);
  });

  test("a missing expires_date throws instead of granting Pro forever", async () => {
    const row = {
      userId: "user-1",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
      source: "revenuecat",
    };
    rows.set("user-1", row);
    subscriber = () => subscriberWith({ pro: { product_identifier: "x" } });

    await expect(syncEntitlementFromRevenueCat("user-1")).rejects.toThrow(
      "RevenueCat returned no expires_date",
    );
    expect(rows.get("user-1")).toEqual(row);
  });

  test("the User row is locked before RevenueCat is read", async () => {
    await syncEntitlementFromRevenueCat("user-1");

    expect(events).toEqual(["lock:user-1", "revenuecat:user-1"]);
  });

  test("a non-2xx response throws with the status only and keeps the row", async () => {
    const row = { userId: "user-1", expiresAt: null, source: "revenuecat" };
    rows.set("user-1", row);
    subscriber = () => new Response("secret details", { status: 503 });

    await expect(syncEntitlementFromRevenueCat("user-1")).rejects.toThrow(
      /^RevenueCat HTTP 503$/,
    );
    expect(rows.get("user-1")).toEqual(row);
  });

  test("a missing secret key throws before any request", async () => {
    delete process.env.REVENUECAT_SECRET_API_KEY;

    await expect(syncEntitlementFromRevenueCat("user-1")).rejects.toThrow(
      "RevenueCat is not configured",
    );
    expect(revenueCatCalls).toHaveLength(0);
  });
});

describe("POST /api/v1/me/entitlement/refresh", () => {
  function refresh() {
    return fetch(`${baseUrl}/api/v1/me/entitlement/refresh`, {
      method: "POST",
    });
  }

  test("syncs the signed-in user and returns the entitlement shape", async () => {
    subscriber = () => subscriberWith({ pro: { expires_date: null } });

    const res = await refresh();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ isPro: true });
    expect(revenueCatCalls.map((call) => call.url)).toEqual([
      "https://api.revenuecat.com/v1/subscribers/user-1",
    ]);
  });

  test("a RevenueCat failure returns 502 ENTITLEMENT_SYNC_FAILED", async () => {
    subscriber = () => new Response("down", { status: 500 });
    const log = spyOn(console, "error").mockImplementation(() => {});

    const res = await refresh();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: {
        code: "ENTITLEMENT_SYNC_FAILED",
        message: "Could not check your subscription.",
      },
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("sk_test_secret");
    log.mockRestore();
  });

  test("a second refresh inside the cooldown returns the DB state without calling RevenueCat", async () => {
    subscriber = () => subscriberWith({ pro: { expires_date: null } });

    await refresh();
    const res = await refresh();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ isPro: true });
    expect(revenueCatCalls).toHaveLength(1);
  });

  test("a failed refresh does not start the cooldown", async () => {
    subscriber = () => new Response("down", { status: 500 });
    const log = spyOn(console, "error").mockImplementation(() => {});
    await refresh();
    log.mockRestore();
    subscriber = () => subscriberWith({ pro: { expires_date: null } });

    const res = await refresh();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ isPro: true });
    expect(revenueCatCalls).toHaveLength(2);
  });
});

describe("isAuthorized", () => {
  test("accepts only the exact configured value", () => {
    expect(isAuthorized("Bearer webhook-secret", "Bearer webhook-secret")).toBe(
      true,
    );
    expect(isAuthorized("Bearer webhook-secre", "Bearer webhook-secret")).toBe(
      false,
    );
    expect(isAuthorized("bearer webhook-secret", "Bearer webhook-secret")).toBe(
      false,
    );
    expect(isAuthorized("", "Bearer webhook-secret")).toBe(false);
    expect(isAuthorized(undefined, "Bearer webhook-secret")).toBe(false);
  });
});

describe("getAppUserIds", () => {
  test("uses app_user_id for ordinary events", () => {
    expect(
      getAppUserIds({ type: "INITIAL_PURCHASE", app_user_id: "user-1" }),
    ).toEqual(["user-1"]);
  });

  test("uses both sides of a TRANSFER, without anonymous IDs or duplicates", () => {
    expect(
      getAppUserIds({
        type: "TRANSFER",
        transferred_from: ["user-1", "$RCAnonymousID:abc"],
        transferred_to: ["user-2", "user-1"],
      }),
    ).toEqual(["user-1", "user-2"]);
  });

  test("ignores anonymous IDs and malformed events", () => {
    expect(
      getAppUserIds({ type: "RENEWAL", app_user_id: "$RCAnonymousID:abc" }),
    ).toEqual([]);
    expect(getAppUserIds({ type: "RENEWAL", app_user_id: 42 })).toEqual([]);
    expect(getAppUserIds({ type: "TRANSFER" })).toEqual([]);
    expect(getAppUserIds(undefined)).toEqual([]);
    expect(getAppUserIds("event")).toEqual([]);
  });
});

describe("POST /api/v1/webhooks/revenuecat", () => {
  function deliver(body: unknown, authorization = "Bearer webhook-secret") {
    return fetch(`${baseUrl}/api/v1/webhooks/revenuecat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization },
      body: JSON.stringify(body),
    });
  }

  test("a wrong Authorization header is 401 and touches nothing", async () => {
    const res = await deliver(
      { event: { type: "INITIAL_PURCHASE", app_user_id: "user-1" } },
      "Bearer wrong",
    );

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(revenueCatCalls).toHaveLength(0);
  });

  test("an unset REVENUECAT_WEBHOOK_AUTH rejects every request", async () => {
    delete process.env.REVENUECAT_WEBHOOK_AUTH;
    const log = spyOn(console, "error").mockImplementation(() => {});

    const res = await deliver(
      { event: { type: "INITIAL_PURCHASE", app_user_id: "user-1" } },
      "",
    );

    expect(res.status).toBe(500);
    expect(revenueCatCalls).toHaveLength(0);
    log.mockRestore();
  });

  test("the event is only a trigger: the row follows RevenueCat, not the body", async () => {
    subscriber = () =>
      subscriberWith({ pro: { expires_date: "2030-01-01T00:00:00Z" } });

    const res = await deliver({
      event: {
        type: "EXPIRATION",
        app_user_id: "user-1",
        expiration_at_ms: 0,
      },
    });

    expect(res.status).toBe(200);
    expect(rows.get("user-1")?.expiresAt).toEqual(
      new Date("2030-01-01T00:00:00Z"),
    );
  });

  test("a redelivered event gives the same result (idempotent)", async () => {
    subscriber = () => subscriberWith({ pro: { expires_date: null } });
    const event = { event: { type: "RENEWAL", app_user_id: "user-1" } };

    await deliver(event);
    const first = rows.get("user-1");
    const res = await deliver(event);

    expect(res.status).toBe(200);
    expect(rows.get("user-1")).toEqual(first!);
    expect(rows.size).toBe(1);
  });

  test("TRANSFER syncs both users, so the source loses Pro", async () => {
    rows.set("user-1", {
      userId: "user-1",
      expiresAt: null,
      source: "revenuecat",
    });
    subscriber = (userId) =>
      userId === "user-2"
        ? subscriberWith({ pro: { expires_date: null } })
        : subscriberWith({});

    const res = await deliver({
      event: {
        type: "TRANSFER",
        transferred_from: ["user-1"],
        transferred_to: ["user-2"],
      },
    });

    expect(res.status).toBe(200);
    expect(rows.has("user-1")).toBe(false);
    expect(rows.get("user-2")?.source).toBe("revenuecat");
  });

  test.each([
    ["the dashboard TEST event", { event: { type: "TEST", app_user_id: "x" } }],
    [
      "an anonymous user",
      {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "$RCAnonymousID:abc",
        },
      },
    ],
    ["a body without event", { hello: "world" }],
  ])("%s gets 200 without calling RevenueCat", async (_name, body) => {
    const res = await deliver(body);

    expect(res.status).toBe(200);
    expect(revenueCatCalls).toHaveLength(0);
  });

  test("a RevenueCat failure is non-2xx so RevenueCat retries", async () => {
    subscriber = () => new Response("down", { status: 503 });
    const log = spyOn(console, "error").mockImplementation(() => {});

    const res = await deliver({
      event: { type: "RENEWAL", app_user_id: "user-1" },
    });

    expect(res.status).toBe(500);
    log.mockRestore();
  });
});
