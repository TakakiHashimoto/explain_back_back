import express from "express";

export const app = express();

app.use(express.json());

// health check end point
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
