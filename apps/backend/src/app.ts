import express from "express";
import { clerkMiddleware } from "@clerk/express";
import authRoutes from "./router/authRoutes.js";

export const app = express();

app.use(express.json());
app.use(clerkMiddleware());

// health check end point
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/v1/me", authRoutes);
