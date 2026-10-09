import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { clerkMiddleware } from "@clerk/express";
import authRoutes from "./routers/authRoutes.js";
import { sendError } from "./lib/errors.js";

export const app = express();

app.use(express.json());
app.use(clerkMiddleware());

// health check end point
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/v1/me", authRoutes);

app.use((_req, res) => {
  sendError(res, "NOT_FOUND");
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  const status = (err as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    sendError(res, "BAD_REQUEST");
    return;
  }

  sendError(res, "INTERNAL_ERROR");
});
