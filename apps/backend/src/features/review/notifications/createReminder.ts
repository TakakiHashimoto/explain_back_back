import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";

export async function createReminder(
  userId: string,
  dueCount: number,
  now: Date,
) {
  if (!userId.trim()) {
    throw new Error("User ID is required");
  }

  if (!Number.isInteger(dueCount) || dueCount <= 0) {
    throw new Error("Due count must be a positive integer");
  }

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("Now must be a valid date");
  }

  const reminderDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  try {
    return prisma.reviewReminder.upsert({
      where: { userId_reminderDate: { userId, reminderDate } },
      update: {},
      create: { userId, reminderDate, dueCount },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "p2002"
    ) {
      const existing = await prisma.reviewReminder.findUnique({
        where: { userId_reminderDate: { userId, reminderDate } },
      });
      if (existing) return existing;
    }
    throw e;
  }
}
