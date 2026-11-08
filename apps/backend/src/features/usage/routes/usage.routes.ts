import { Router } from "express";
import { getUsage } from "../usage.service.js";
import { requireUser } from "../../../middleware/require-user.js";
import { syncEntitlementFromRevenueCat } from "../entitlement/syncEntitlement.js";
import { AppError } from "../../../lib/errors.js";

const router = Router();

router.use(requireUser);

router.get("/entitlement", async (req, res) => {
  const entitlement = await getUsage(req.user!.id, new Date());

  res.json(entitlement);
});

// Called by the app right after a purchase / restore, so Pro shows up without waiting
// for the webhook. No body: the user comes from the session, never from the client.
router.post("/entitlement/refresh", async (req, res) => {
  try {
    await syncEntitlementFromRevenueCat(req.user!.id);
  } catch (error) {
    // Our own messages only carry the HTTP status, never the key.
    console.error(
      "Entitlement refresh failed",
      error instanceof Error ? error.message : "unknown error",
    );
    throw new AppError("ENTITLEMENT_SYNC_FAILED");
  }

  const entitlement = await getUsage(req.user!.id, new Date());

  res.json(entitlement);
});

export default router;
