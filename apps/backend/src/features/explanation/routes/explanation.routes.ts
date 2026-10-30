import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { requireUser } from "../../../middleware/require-user.js";
import { AppError } from "../../../lib/errors.js";
import { createExplanation } from "../controllers/createExplanation.controller.js";
import { MAX_AUDIO_BYTES } from "../explanation.const.js";

const router = Router();

// Keep the audio in memory only; it is never written to disk or storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 5 },
}).single("audio");

/** Runs multer and turns its errors (too large, wrong field) into INVALID_AUDIO. */
function uploadAudio(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) return next(new AppError("INVALID_AUDIO"));
    next(err);
  });
}

router.use(requireUser);

// TODO: move to /topics/:topicId/explanations once Topic becomes a table (spec §26)
router.post("/", uploadAudio, createExplanation);

export default router;
