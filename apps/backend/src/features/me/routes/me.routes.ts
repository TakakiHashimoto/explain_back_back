import { Router } from "express";
import { requireUser } from "../../../middleware/requireUser.js";

const router = Router();

router.use(requireUser);

router.get("/", (req, res) => {
  res.json({ id: req.user!.id });
});

export default router;
