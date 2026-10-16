import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { clerkMiddleware } from "@clerk/express";
import authRoutes from "./features/auth/auth.routes.js";
import devRoutes from "./features/usage/routes/dev.routes.js";
import usageRoutes from "./features/usage/routes/usage.routes.js";
import { AppError, sendError } from "./lib/errors.js";
import reviewRouter from "./features/review/routes/review.router.js";

export const app = express();

app.use(express.json());
// health check end point
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
// checks request cookies and headers for session tokens, then attaches an authentication object to the Express request
app.use(clerkMiddleware());

app.use("/api/v1/me", authRoutes);
app.use("/api/v1/me", usageRoutes);
app.use("/api/v1/review-questions", reviewRouter);

// test endpoint
if (process.env.NODE_ENV !== "production") {
  app.use("/api/v1/dev", devRoutes);
}

app.use((_req, res) => {
  sendError(res, "NOT_FOUND");
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  if (err instanceof AppError) {
    sendError(res, err.code);
    return;
  }

  const status = (err as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    sendError(res, "BAD_REQUEST");
    return;
  }

  sendError(res, "INTERNAL_ERROR");
});
