import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { Plan } from "../generated/prisma/enums.js";

export async function getPlan(
  userId: string,
  db: Prisma.TransactionClient = prisma,
  now: Date,
): Promise<Plan> {
  const entitlement = await db.entitlement.findUnique({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  return entitlement ? "PRO" : "FREE";
}
