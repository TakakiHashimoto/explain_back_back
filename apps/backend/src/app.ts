import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
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

app.use((_req, res) => {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Route not found." } });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
  });
});
