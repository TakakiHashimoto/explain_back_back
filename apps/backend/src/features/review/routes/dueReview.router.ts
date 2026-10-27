import { Router } from "express";
import { requireUser } from "../../../middleware/require-user.js";
import { getDueReviewsController } from "../controllers/dueReview.controller.js";
import { getHistoryController } from "../controllers/getHistory.controller.js";

const router = Router();

router.use(requireUser);

router.get("/due", getDueReviewsController);
router.get("/history", getHistoryController);

export default router;
