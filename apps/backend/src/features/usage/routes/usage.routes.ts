import { Router } from "express";
import { getUsage } from "../usage.service.js";
import { requireUser } from "../../../middleware/require-user.js";
import { syncEntitlementFromRevenueCat } from "../entitlement/syncEntitlement.js";
import { AppError } from "../../../lib/errors.js";

const router = Router();

// Each refresh calls the RevenueCat REST API, whose rate limit is shared by the whole project
// (the webhook needs it too). One refresh per user per cooldown; calls inside it get the
// current state from our DB. In memory, so the limit is per backend instance.
const REFRESH_COOLDOWN_MS = 10_000;
const lastRefreshAt = new Map<string, number>();

/** Starts the user's cooldown; false when one is already running. */
function startRefreshCooldown(userId: string, now: number): boolean {
  // Entries only live for the cooldown, so this loop stays small.
  for (const [id, at] of lastRefreshAt) {
    if (now - at >= REFRESH_COOLDOWN_MS) lastRefreshAt.delete(id);
  }
  if (lastRefreshAt.has(userId)) return false;
  lastRefreshAt.set(userId, now);
  return true;
}

/** For tests: forget every cooldown. */
export function clearRefreshCooldowns(): void {
  lastRefreshAt.clear();
}

router.use(requireUser);

router.get("/entitlement", async (req, res) => {
  const entitlement = await getUsage(req.user!.id, new Date());

  res.json(entitlement);
});

// Called by the app right after a purchase / restore, so Pro shows up without waiting
// for the webhook. No body: the user comes from the session, never from the client.
router.post("/entitlement/refresh", async (req, res) => {
  const userId = req.user!.id;
  try {
    if (startRefreshCooldown(userId, Date.now())) {
      await syncEntitlementFromRevenueCat(userId);
    }
  } catch (error) {
    // A failed sync does not count, so the user can retry right away.
    lastRefreshAt.delete(userId);
    // Our own messages only carry the HTTP status, never the key.
    console.error(
      "Entitlement refresh failed",
      error instanceof Error ? error.message : "unknown error",
    );
    throw new AppError("ENTITLEMENT_SYNC_FAILED");
  }

  const entitlement = await getUsage(userId, new Date());

  res.json(entitlement);
});

export default router;
