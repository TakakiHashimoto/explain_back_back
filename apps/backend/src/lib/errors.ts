import type { Response } from "express";

export const ERRORS = {
  UNAUTHENTICATED: { status: 401, message: "Authentication required." },
  BAD_REQUEST: { status: 400, message: "Invalid request." },
  NOT_FOUND: { status: 404, message: "Route not found." },
  INTERNAL_ERROR: { status: 500, message: "Something went wrong." },
} as const;

export type ErrorCode = keyof typeof ERRORS;

export function sendError(res: Response, code: ErrorCode) {
  const { status, message } = ERRORS[code];
  res.status(status).json({ error: { code, message } });
}
