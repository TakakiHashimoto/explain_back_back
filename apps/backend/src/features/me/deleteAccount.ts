import { clerkClient } from "@clerk/express";
import { prisma } from "../../lib/prisma.js";

export async function deleteAccountData(userId: string) {
  // 1. delete RevenueCat account
  await deleteRevenueCatAccount(userId);

  // 2. delete OneSignal account
  await deleteOneSignalAccount(userId);

  // 3. delete app account at the end
  await prisma.user.deleteMany({ where: { id: userId } });
}

const SUBSCRIBERS_URL = "https://api.revenuecat.com/v1/subscribers/";

/**
 * Deletes the RevenueCat account for the given user ID.
 * @param userId - The internal User.id, which is also the RevenueCat App User ID (spec §31).
 */
async function deleteRevenueCatAccount(userId: string) {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    throw new Error("RevenueCat is not configured");
  }

  const response = await fetch(
    `${SUBSCRIBERS_URL}${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    },
  );

  // 404 is counted as success, since the account does not exist.
  if (!response.ok && response.status !== 404) {
    throw new Error(`RevenueCat HTTP ${response.status}`);
  }
}

/**
 * Deletes the OneSignal account for the given user ID.
 * @param userId - The internal User.id, which is also the OneSignal External User ID (spec §31).
 */
async function deleteOneSignalAccount(userId: string) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    throw new Error("OneSignal is not configured");
  }

  const response = await fetch(
    `https://api.onesignal.com/apps/${encodeURIComponent(appId)}/users/by/external_id/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Key ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    },
  );

  // 404 is counted as success, since the account does not exist.
  if (!response.ok && response.status !== 404) {
    throw new Error(`OneSignal HTTP ${response.status}`);
  }
}

export async function deleteClerkUser(authSubject: string) {
  try {
    await clerkClient.users.deleteUser(authSubject);
  } catch (error) {
    if ((error as { status?: number }).status === 404) return;
    throw error;
  }
}
