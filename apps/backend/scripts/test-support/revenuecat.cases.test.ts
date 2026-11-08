import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// No database and no RevenueCat: Prisma is an in-memory fake and fetch is stubbed.
// Run: bun test scripts/revenuecat.test.ts
type Row = { userId: string; expiresAt: Date | null; source: string };
let rows: Map<string, Row>;

mock.module("../../src/lib/prisma.js", () => ({
  prisma: {
    entitlement: {
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
    },
  },
}));

const { syncEntitlementFromRevenueCat } = await import(
  "../../src/features/usage/entitlement/syncEntitlement.js"
);

const realFetch = globalThis.fetch;
const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
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
      return subscriber(decodeURIComponent(url.split("/").at(-1)!));
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
  revenueCatCalls = [];
  subscriber = () => subscriberWith({});
  process.env.REVENUECAT_SECRET_API_KEY = "sk_test_secret";
  stubRevenueCat();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (apiKey === undefined) delete process.env.REVENUECAT_SECRET_API_KEY;
  else process.env.REVENUECAT_SECRET_API_KEY = apiKey;
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

  test("a row from another source is never changed", async () => {
    const manual = { userId: "user-1", expiresAt: null, source: "manual" };
    rows.set("user-1", manual);

    await syncEntitlementFromRevenueCat("user-1");

    expect(rows.get("user-1")).toEqual(manual);
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
