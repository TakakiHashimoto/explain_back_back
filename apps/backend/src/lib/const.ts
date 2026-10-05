import { Plan, UsageKind } from "../generated/prisma/enums.js";

export const LIMITS = {
  PRO: { ANALYSIS: 20, REVIEW: 120 },
  FREE: { ANALYSIS: 3, REVIEW: 18 },
} satisfies Record<Plan, Record<UsageKind, number>>;

export const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const IN_PROGRESS_TIMEOUT_MS = 10 * 60 * 1000;
