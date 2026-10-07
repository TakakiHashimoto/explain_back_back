import { Router } from "express";
import { completeUsage, reserveUsage } from "../service/usage.js";
import { requireUser } from "../middleware/require-user.js";

const router = Router();

router.use(requireUser);

// start -> stay not completed
router.post("/review/start", async (req, res) => {
  const reservedRecordId = await reserveUsage(req.user!.id, "REVIEW");
  res.json({ reservedRecordId });
});

// start -> complete
router.post("/review/complete", async (req, res) => {
  const reservedRecordId = await reserveUsage(req.user!.id, "REVIEW");
  await completeUsage(reservedRecordId, true);
  res.json({ reservedRecordId });
});

// start -> fail
router.post("/review/fail", async (req, res) => {
  const reservedRecordId = await reserveUsage(req.user!.id, "REVIEW");
  await completeUsage(reservedRecordId, false);
  res.json({ reservedRecordId });
});

// start -> stay not completed
router.post("/analysis/start", async (req, res) => {
  const reservedRecordId = await reserveUsage(req.user!.id, "ANALYSIS");
  res.json({ reservedRecordId });
});

// start -> complete
router.post("/analysis/complete", async (req, res) => {
  const reservedRecordId = await reserveUsage(req.user!.id, "ANALYSIS");
  await completeUsage(reservedRecordId, true);
  res.json({ reservedRecordId });
});

// start -> fail
router.post("/analysis/fail", async (req, res) => {
  const reservedRecordId = await reserveUsage(req.user!.id, "ANALYSIS");
  await completeUsage(reservedRecordId, false);
  res.json({ reservedRecordId });
});

export default router;
