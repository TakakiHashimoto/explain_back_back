import { NextFunction, Request, Response } from "express";

async function generateReviewQuestion(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { gapId } = req.params;
  if (!gapId) {
    throw new Error("Missing gap id");
  }

  // fing knowledge gap matching with gapId from db

  // based on this fetched knowledge gap, have AI generate revieew question

  // validate this review question

  // save this review question in DB

  // return this review question
}
