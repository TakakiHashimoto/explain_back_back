import { Router } from "express";
import { requireUser } from "../../../middleware/require-user.js";
import { generateReviewQuestion } from "../controllers/reviewQuestion.controller.js";

const router = Router();

router.use(requireUser);

router.post("/:gapId/review-questions", generateReviewQuestion);

export default router;
