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
