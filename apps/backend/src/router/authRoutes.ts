import { Router } from "express";
import { requireUser } from "../middleware/require-user.js";
import { getUsage } from "../service/usage.js";

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
