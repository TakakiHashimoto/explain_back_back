import { Request, Response } from "express";
import { getHistory } from "../services/getHistory.js";

export async function getHistoryController(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const histories = await getHistory(req.user.id);
  res.status(200).json({ data: histories });
  return;
}
