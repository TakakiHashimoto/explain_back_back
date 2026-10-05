import { Plan, UsageKind } from "../generated/prisma/enums.js";
import { IN_PROGRESS_TIMEOUT_MS, LIMITS, WINDOW_MS } from "../lib/const.js";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { getPlan } from "./entitlement.js";

export async function reserveUsage(
  userId: string,
  kind: UsageKind,
): Promise<string> {
  // Use interactive transaction block, not main prisma instance
  return prisma.$transaction(async (tx) => {
    // Lock the User row (all queries below must use tx, not prisma)
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

    const now = new Date();

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    const userPlan: Plan = await getPlan(userId, tx, now);
    const windowPlan = user.usageWindowPlan;
    let windowStart = user.usageWindowStartAt;

    if (
      windowStart === null ||
      windowStart.getTime() + WINDOW_MS <= now.getTime() ||
      windowPlan !== userPlan
    ) {
      await tx.user.update({
        where: { id: userId },
        data: {
          usageWindowStartAt: now,
          usageWindowPlan: userPlan,
        },
      });
      windowStart = now;
    }

    const inProgressCutoffDate = new Date(
      now.getTime() - IN_PROGRESS_TIMEOUT_MS,
    );
    const count = await tx.usageRecord.count({
      where: {
        userId,
        kind,
        createdAt: { gte: windowStart },
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

// TODO
export async function completeUsage(id: string, succeeded: boolean) {}
