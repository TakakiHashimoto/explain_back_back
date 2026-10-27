function getSafeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown notification error";
  }

  if (error.name === "TimeoutError") {
    return "OneSignal request timed out";
  }

  if (error.name === "AbortError") {
    return "OneSignal request was aborted";
  }

  return "Notification processing failed";
}
