import { prisma } from "../../../lib/prisma.js";

// Business code only knows the entitlement, never product IDs (spec §30).
const PRO_ENTITLEMENT = "pro";
// Entitlement.source for rows this module owns; active rows from other sources are left alone.
export const REVENUECAT_SOURCE = "revenuecat";

const SUBSCRIBERS_URL = "https://api.revenuecat.com/v1/subscribers/";

/** The fields we read from `subscriber.entitlements.<id>` (REST API v1). Untrusted input. */
type RevenueCatEntitlement = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
};

type SubscriberResponse = {
  subscriber?: { entitlements?: Record<string, RevenueCatEntitlement> };
};

// The RevenueCat call (10 s timeout) runs inside the transaction, plus a margin for the DB work.
const SYNC_TRANSACTION_TIMEOUT_MS = 15_000;

/**
 * Reads the user's "pro" entitlement from the RevenueCat REST API and mirrors it into our
 * Entitlement row. RevenueCat is asked every time, so calling this again, or out of order,
 * always converges on RevenueCat's current state.
 *
 * Syncs for one user are serialized by locking the User row (same pattern as reserveUsage),
 * and RevenueCat is read inside that lock. So the sync that writes last is also the one that
 * read RevenueCat last: a refresh and a webhook running together cannot leave a stale state.
 * Trade-off: a DB connection is held during the RevenueCat call.
 * @param userId - Internal User.id, which is also the RevenueCat App User ID (spec §31).
 * @throws Error when RevenueCat is not configured, unreachable, returns a non-2xx status or
 * a malformed entitlement.
 */
export async function syncEntitlementFromRevenueCat(
  userId: string,
): Promise<void> {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    throw new Error("RevenueCat is not configured");
  }

  await prisma.$transaction(
    async (tx) => {
      // Lock the User row (all queries below must use tx, not prisma)
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

      const pro = await fetchProEntitlement(userId, apiKey);

      const existing = await tx.entitlement.findUnique({ where: { userId } });
      if (
        existing &&
        existing.source !== REVENUECAT_SOURCE &&
        isActive(existing.expiresAt, new Date())
      ) {
        // Granted outside RevenueCat (e.g. by hand) and still active; RevenueCat must not
        // revoke or shorten it. Once it has expired, a RevenueCat purchase takes the row over.
        return;
      }

      if (!pro) {
        await tx.entitlement.deleteMany({
          where: { userId, source: REVENUECAT_SOURCE },
        });
        return;
      }

      const expiresAt = toExpiresAt(pro);
      await tx.entitlement.upsert({
        where: { userId },
        create: { userId, expiresAt, source: REVENUECAT_SOURCE },
        update: { expiresAt, source: REVENUECAT_SOURCE },
      });
    },
    { timeout: SYNC_TRANSACTION_TIMEOUT_MS },
  );
}

/** GET /v1/subscribers/{id} and return its "pro" entitlement, or undefined when there is none. */
async function fetchProEntitlement(
  userId: string,
  apiKey: string,
): Promise<RevenueCatEntitlement | undefined> {
  // No X-Platform header: this is an informational read and must not touch `last_seen`.
  const response = await fetch(
    `${SUBSCRIBERS_URL}${encodeURIComponent(userId)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    // Only the status: the body may echo request details.
    throw new Error(`RevenueCat HTTP ${response.status}`);
  }

  const body = (await response.json()) as SubscriberResponse;
  // The dictionary also contains expired entitlements; getPlan() compares expiresAt with now.
  return body.subscriber?.entitlements?.[PRO_ENTITLEMENT];
}

/** Same rule as getPlan(): null never expires, otherwise active until expiresAt. */
function isActive(expiresAt: Date | null, now: Date): boolean {
  return expiresAt === null || expiresAt > now;
}

/**
 * The time Pro ends: null for a non-expiring (lifetime) entitlement, otherwise the later of
 * `expires_date` and `grace_period_expires_date`, so a billing grace period keeps Pro.
 * Only an explicit null means lifetime: a missing field must never grant Pro forever.
 */
function toExpiresAt(entitlement: RevenueCatEntitlement): Date | null {
  if (entitlement.expires_date === null) return null;
  if (typeof entitlement.expires_date !== "string") {
    throw new Error("RevenueCat returned no expires_date");
  }

  const dates = [
    entitlement.expires_date,
    entitlement.grace_period_expires_date,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => new Date(value));
  if (dates.some((date) => Number.isNaN(date.getTime()))) {
    throw new Error("RevenueCat returned an invalid date");
  }

  return new Date(Math.max(...dates.map((date) => date.getTime())));
}
