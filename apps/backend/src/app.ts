import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { clerkMiddleware } from "@clerk/express";
import authRoutes from "./features/auth/auth.routes.js";
import reviewRouter from "./features/review/routes/review.router.js";
import { sendError } from "./lib/errors.js";

export const app = express();

app.use(express.json());
// checks request cookies and headers for session tokens, then attaches an authentication object to the Express request
app.use(clerkMiddleware());

// health check end point
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/v1/me", authRoutes);
app.use("/api/v1/review-questions", reviewRouter);

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
