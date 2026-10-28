export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "Notification request timed out";
    }

    const match = /^OneSignal HTTP ([45][0-9]{2})$/.exec(error.message);

    if (match && match[0] === error.message) {
      return `OneSignal HTTP ${match[1]}`;
    }
  }

  return "Notification processing failed";
}
