export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "Notification request timed out";
    }

    const match = /^OneSignal HTTP ([0-9]{3})$/.exec(error.message);

    if (match) {
      return `OneSignal HTTP ${match[1]}`;
    }
  }

  return "Notification processing failed";
}
