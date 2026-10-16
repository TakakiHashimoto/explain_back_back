import { Router } from "express";
import { getUsage } from "../usage.service.js";
import { requireUser } from "../../../middleware/require-user.js";

const router = Router();

router.use(requireUser);

router.get("/entitlement", async (req, res) => {
  const entitlement = await getUsage(req.user!.id, new Date());

  res.json(entitlement);
});

export default router;
