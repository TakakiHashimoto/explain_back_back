export async function sendReviewReminder(
  userId: string,
  dueCount: number,
): Promise<string> {
  // 1. Validate function arguments
  if (!userId.trim()) {
    throw new Error("User ID is required");
  }

  if (!Number.isInteger(dueCount) || dueCount <= 0) {
    throw new Error("Due count must be a positive integer");
  }

  // 2. Read environment configuration
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    throw new Error("OneSignal is not configured");
  }

  // 3. Construct the notification payload
  const payload = {
    app_id: appId,
    include_aliases: {
      external_id: [userId],
    },
    target_channel: "push",
    headings: {
      en: "Time to review",
    },
    contents: {
      en: `You have ${dueCount} questions ready to review.`,
    },
  };

  // 4. Send the notification to OneSignal
  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // 5. Reject unsuccessful HTTP responses
  if (!response.ok) {
    throw new Error(`OneSignal request failed with status ${response.status}`);
  }

  // 6. Verify that OneSignal created a notification
  const result: unknown = await response.json();
  if (
    typeof result !== "object" ||
    result === null ||
    !("id" in result) ||
    typeof result.id !== "string" ||
    !result.id.trim()
  ) {
    throw new Error("OneSignal response did not include a notification ID");
  }

  return result.id;
}
