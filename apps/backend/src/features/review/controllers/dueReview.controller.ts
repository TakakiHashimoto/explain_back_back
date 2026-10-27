import { NextFunction, Request, Response } from "express";
import { getDueReviews } from "../services/getDueReviews.js";

export async function getDueReviewsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const shcedules = await getDueReviews(req.user.id, new Date());

  res.status(200).json({ data: shcedules });
}
