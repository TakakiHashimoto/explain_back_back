import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { User } from "../generated/prisma/client.js";
import { sendError } from "../lib/errors.js";

// Make req.user known to TypeScript for every route.
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Rejects unauthenticated requests and attaches the internal User to req.user.
 */
export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Already resolved by an earlier router on the same path; skip the extra DB upsert.
  if (req.user) return next();

  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated) {
    sendError(res, "UNAUTHENTICATED");
    return;
  }

  // Get-or-create: `update` is empty, so an existing row is returned unchanged.
  req.user = await prisma.user.upsert({
    where: { authSubject: userId },
    update: {},
    create: { authSubject: userId },
  });

  next();
}
