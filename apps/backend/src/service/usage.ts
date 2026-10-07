import { Plan, UsageKind } from "../generated/prisma/enums.js";
import { IN_PROGRESS_TIMEOUT_MS, LIMITS, WINDOW_MS } from "../lib/const.js";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { getPlan } from "./entitlement.js";

type Usage = {
  isPro: boolean;
  usage: {
    analyses: {
      used: number;
      limit: number;
    };
    reviews: {
      used: number;
      limit: number;
    };
    windowEnd?: Date;
  };
};

/**
 * Gets the usage statistics for a user.
 * @param {String} userId - The ID of the user to get usage statistics for.
 * @param {Date} now - The current date and time.
 * @returns {Promise<Usage>} - A promise that resolves to an object containing the user's usage statistics.
 */
export async function getUsage(userId: string, now: Date): Promise<Usage> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const plan: Plan = await getPlan(userId, now);
  const isPro = plan === "PRO";
  const windowPlan = user.usageWindowPlan;

  const inProgressCutoffDate = new Date(now.getTime() - IN_PROGRESS_TIMEOUT_MS);

  const window = resolveWindow(user.usageWindowStartAt, windowPlan, plan, now);

  if (window.isNew) {
    return {
      isPro,
      usage: {
        analyses: {
          used: 0,
          limit: LIMITS[plan]["ANALYSIS"],
        },
        reviews: {
          used: 0,
          limit: LIMITS[plan]["REVIEW"],
        },
      },
    };
  }

  const windowEnd = new Date(window.start.getTime() + WINDOW_MS);

  const countRows = await prisma.usageRecord.groupBy({
    by: ["kind"],
    _count: { _all: true },
    where: {
      userId,
      createdAt: { gte: window.start },
      OR: [
        { status: "SUCCEEDED" },
        { status: "IN_PROGRESS", createdAt: { gte: inProgressCutoffDate } },
      ],
    },
  });

  const counts: Record<UsageKind, number> = { ANALYSIS: 0, REVIEW: 0 };
  for (const countRow of countRows) {
    counts[countRow.kind] = countRow._count._all;
  }

  return {
    isPro,
    usage: {
      analyses: {
        used: counts.ANALYSIS,
        limit: LIMITS[plan].ANALYSIS,
      },
      reviews: {
        used: counts.REVIEW,
        limit: LIMITS[plan].REVIEW,
      },
      windowEnd,
    },
  };
}

/**
 * Resolves the usage window for a user based on their current plan and the current time.
 * @param {Date | null} windowStart - The start date of the current usage window.
 * @param {Plan | null} windowPlan - The plan associated with the current usage window.
 * @param {Plan} plan - The user's current plan.
 * @param {Date} now - The current date and time.
 * @returns {{ isNew: boolean; start: Date }} - An object containing whether the window is new and its start date.
 */
export function resolveWindow(
  windowStart: Date | null,
  windowPlan: Plan | null,
  plan: Plan,
  now: Date,
): { isNew: boolean; start: Date } {
  const isNew =
    windowStart === null ||
    windowStart.getTime() + WINDOW_MS <= now.getTime() ||
    windowPlan !== plan;

  return isNew ? { isNew, start: now } : { isNew, start: windowStart };
}

/**
 * Reserves a usage record for a user, ensuring that the user has not exceeded their usage limits.
 * This function performs an interactive transaction to lock the user's row, count their usage, and create a new usage record atomically.
 * @param {String} userId - The ID of the user for whom to reserve usage.
 * @param {UsageKind} kind - The kind of usage to reserve (e.g., "ANALYSIS" or "REVIEW").
 * @returns {Promise<String>} - A promise that resolves to the ID of the newly created usage record.
 * @throws {AppError} - Throws an AppError if the user has reached their usage limit.
 */
export async function reserveUsage(
  userId: string,
  kind: UsageKind,
): Promise<string> {
  // Interactive transaction: lock, count and create must happen atomically
  return prisma.$transaction(async (tx) => {
    // Lock the User row (all queries below must use tx, not prisma)
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

    const now = new Date();

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    const userPlan: Plan = await getPlan(userId, now, tx);
    const windowPlan = user.usageWindowPlan;

    const window = resolveWindow(
      user.usageWindowStartAt,
      windowPlan,
      userPlan,
      now,
    );

    if (window.isNew) {
      await tx.user.update({
        where: { id: userId },
        data: {
          usageWindowStartAt: window.start,
          usageWindowPlan: userPlan,
        },
      });
    }

    const inProgressCutoffDate = new Date(
      now.getTime() - IN_PROGRESS_TIMEOUT_MS,
    );

    const count = await tx.usageRecord.count({
      where: {
        userId,
        kind,
        createdAt: { gte: window.start },
        OR: [
          { status: "SUCCEEDED" },
          { status: "IN_PROGRESS", createdAt: { gte: inProgressCutoffDate } },
        ],
      },
    });

    if (count >= LIMITS[userPlan][kind]) {
      throw new AppError(
        userPlan === "FREE" ? "FREE_LIMIT_REACHED" : "USAGE_LIMIT_REACHED",
      );
    }

    return (await tx.usageRecord.create({ data: { userId, kind } })).id;
  });
}

/**
 * Completes a usage record by updating its status to either "SUCCEEDED" or "FAILED".
 * @param {String} id - The ID of the usage record to complete.
 * @param {Boolean} succeeded - A boolean indicating whether the usage succeeded (true) or failed (false).
 * @returns {Promise<void>} - A promise that resolves when the usage record has been updated.
 */
export async function completeUsage(id: string, succeeded: boolean) {
  await prisma.usageRecord.updateMany({
    where: { id, status: "IN_PROGRESS" },
    data: { status: succeeded ? "SUCCEEDED" : "FAILED" },
  });
}
