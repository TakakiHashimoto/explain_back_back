import { prisma } from "../../../lib/prisma.js";

// Business code only knows the entitlement, never product IDs (spec §30).
const PRO_ENTITLEMENT = "pro";
// Entitlement.source for rows this module owns; rows from other sources are left alone.
export const REVENUECAT_SOURCE = "revenuecat";

const SUBSCRIBERS_URL = "https://api.revenuecat.com/v1/subscribers/";

/** The fields we read from `subscriber.entitlements.<id>` (REST API v1). */
type RevenueCatEntitlement = {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
};

type SubscriberResponse = {
  subscriber?: { entitlements?: Record<string, RevenueCatEntitlement> };
};

/**
 * Reads the user's "pro" entitlement from the RevenueCat REST API and mirrors it into our
 * Entitlement row. RevenueCat is asked every time, so calling this again, or out of order,
 * always converges on RevenueCat's current state.
 * @param userId - Internal User.id, which is also the RevenueCat App User ID (spec §31).
 * @throws Error when RevenueCat is not configured, unreachable or returns a non-2xx status.
 */
export async function syncEntitlementFromRevenueCat(
  userId: string,
): Promise<void> {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    throw new Error("RevenueCat is not configured");
  }

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
  const pro = body.subscriber?.entitlements?.[PRO_ENTITLEMENT];

  const existing = await prisma.entitlement.findUnique({ where: { userId } });
  if (existing && existing.source !== REVENUECAT_SOURCE) {
    // Granted outside RevenueCat (e.g. by hand); RevenueCat must not revoke or shorten it.
    return;
  }

  if (!pro) {
    await prisma.entitlement.deleteMany({
      where: { userId, source: REVENUECAT_SOURCE },
    });
    return;
  }

  const expiresAt = toExpiresAt(pro);
  await prisma.entitlement.upsert({
    where: { userId },
    create: { userId, expiresAt, source: REVENUECAT_SOURCE },
    update: { expiresAt },
  });
}

/**
 * The time Pro ends: null for a non-expiring (lifetime) entitlement, otherwise the later of
 * `expires_date` and `grace_period_expires_date`, so a billing grace period keeps Pro.
 */
function toExpiresAt(entitlement: RevenueCatEntitlement): Date | null {
  if (entitlement.expires_date === null) return null;

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
