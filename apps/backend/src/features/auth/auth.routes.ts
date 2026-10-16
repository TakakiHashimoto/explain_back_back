import { Router } from "express";
import { getUsage } from "../../service/usage.js";
import { requireUser } from "../../middleware/require-user.js";

const router = Router();

router.use(requireUser);

router.get("/", (req, res) => {
  res.json({ id: req.user!.id });
});

router.get("/entitlement", async (req, res) => {
  const entitlement = await getUsage(req.user!.id, new Date());

  res.json(entitlement);
});

export default router;
