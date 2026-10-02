import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { requireUser } from "./middleware/require-user.js";

export const app = express();

app.use(express.json());
app.use(clerkMiddleware());

// health check end point
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Bootstrap
app.get("/me", requireUser, (req, res) => {
  res.json({ id: req.user!.id });
});
