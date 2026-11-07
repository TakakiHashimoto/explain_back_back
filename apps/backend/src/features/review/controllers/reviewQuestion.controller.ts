import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../lib/errors.js";
import { ensureReviewQuestion } from "../services/ensureReviewQuestion.js";

// Preserve the existing HTTP contract while sharing generation with server callers.
export async function generateReviewQuestion(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { gapId } = req.params;
  if (typeof gapId !== "string" || !gapId.trim()) {
    return res.status(400).json({ error: "Gap ID is required" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const result = await ensureReviewQuestion(req.user.id, gapId);
    return res.status(result.created ? 201 : 200).json({ data: result.question });
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      return res.status(404).json({ error: "Knowledge gap was not found" });
    }
    next(error);
  }
}
