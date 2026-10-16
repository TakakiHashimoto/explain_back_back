import { Router } from "express";
import { requireUser } from "../../../middleware/require-user.js";

const router = Router();

router.use(requireUser);

router.post("/:gapId/review-questions");

export default router;
