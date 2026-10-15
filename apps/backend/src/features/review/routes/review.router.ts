import { Router } from "express";
import { requireUser } from "../../../middleware/require-user.js";
import { reviewAnswers } from "../controllers/review.controller.js";

const router = Router();
router.use(requireUser);

router.post("/:questionId/attempts", reviewAnswers);

export default router;
