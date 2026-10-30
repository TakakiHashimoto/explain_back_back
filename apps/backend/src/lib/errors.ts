import type { Response } from "express";

export const ERRORS = {
  UNAUTHENTICATED: { status: 401, message: "Authentication required." },
  BAD_REQUEST: { status: 400, message: "Invalid request." },
  NOT_FOUND: { status: 404, message: "Not found." },
  INTERNAL_ERROR: { status: 500, message: "Something went wrong." },
  FREE_LIMIT_REACHED: { status: 429, message: "Reached free limit." },
  USAGE_LIMIT_REACHED: { status: 429, message: "Reached fair use limit." },
  INVALID_AUDIO: { status: 400, message: "Invalid audio file." },
  TRANSCRIPTION_FAILED: { status: 502, message: "Could not transcribe the audio." },
} as const;

export type ErrorCode = keyof typeof ERRORS;

export function sendError(res: Response, code: ErrorCode) {
  const { status, message } = ERRORS[code];
  res.status(status).json({ error: { code, message } });
}

export class AppError extends Error {
  constructor(public code: ErrorCode) {
    super(ERRORS[code].message);
  }
}
