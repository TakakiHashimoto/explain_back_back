import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { sendError } from "../../../lib/errors.js";
import { syncEntitlementFromRevenueCat } from "../entitlement/syncEntitlement.js";

// IDs the SDK makes before identify(); they are never one of our users.
const ANONYMOUS_PREFIX = "$RCAnonymousID:";

/**
 * Constant-time comparison of the Authorization header with the configured value.
 * Both sides are hashed first so their lengths match, which timingSafeEqual requires.
 */
export function isAuthorized(
  header: string | undefined,
  expected: string,
): boolean {
  if (header === undefined) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(expected));
}

/**
 * App User IDs whose entitlement may have changed. The event is only a trigger:
 * the state itself is read from RevenueCat, so its other fields are not trusted.
 * TRANSFER has no app_user_id; both sides of the transfer are returned instead.
 */
export function getAppUserIds(event: unknown): string[] {
  if (typeof event !== "object" || event === null) return [];
  const { type, app_user_id, transferred_from, transferred_to } =
    event as Record<string, unknown>;

  const candidates =
    type === "TRANSFER"
      ? [transferred_from, transferred_to].flatMap((ids) =>
          Array.isArray(ids) ? ids : [],
        )
      : [app_user_id];

  const ids = candidates.filter(
    (id): id is string =>
      typeof id === "string" && id !== "" && !id.startsWith(ANONYMOUS_PREFIX),
  );
  return [...new Set(ids)];
}

const router = Router();

/**
 * RevenueCat webhook (spec §33). Mounted without requireUser: RevenueCat authenticates with
 * the Authorization header configured in its dashboard. Only a 200 counts as delivered, so
 * events we cannot act on still get 200; a non-2xx (sync failure) makes RevenueCat retry.
 */
router.post("/revenuecat", async (req, res) => {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected) {
    console.error("RevenueCat webhook is not configured");
    sendError(res, "INTERNAL_ERROR");
    return;
  }
  if (!isAuthorized(req.get("authorization"), expected)) {
    sendError(res, "UNAUTHENTICATED");
    return;
  }

  // Express 5 leaves req.body undefined when there is no JSON body.
  const appUserIds = getAppUserIds(req.body?.event);
  // Unknown IDs (e.g. the dashboard's TEST event) are skipped; RevenueCat's GET would create them.
  const users = appUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: appUserIds } },
        select: { id: true },
      })
    : [];

  // A thrown error reaches the error handler (500), and RevenueCat retries the event.
  for (const { id } of users) {
    await syncEntitlementFromRevenueCat(id);
  }

  res.json({ received: true });
});

export default router;
