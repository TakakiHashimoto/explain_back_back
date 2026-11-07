/** Notification data selects a fixed screen, never a user, question or URL. */
export function reviewReminderId(event: unknown): string | null {
  if (!event || typeof event !== 'object' || !('notification' in event)) return null;
  const notification = event.notification;
  if (!notification || typeof notification !== 'object'
    || !('notificationId' in notification) || typeof notification.notificationId !== 'string'
    || !notification.notificationId.trim() || !('additionalData' in notification)) return null;
  const data = notification.additionalData;
  return data && typeof data === 'object' && 'type' in data
    && data.type === 'due_review_reminder' ? notification.notificationId : null;
}

/** One bridge lifetime. undefined = Clerk loading; null = signed out. */
export function createReviewReminderNavigation() {
  let session: string | null | undefined;
  let ready = false;
  let pending: string | null = null;
  const seen = new Set<string>();
  return {
    setSession(next: string | null | undefined) {
      ready = next !== undefined;
      if (next === undefined) return;
      // Discard a pending tap from the previous authenticated session, including
      // sign-out and direct account switches. A signed-out cold start can wait
      // for sign-in, since it carries only an instruction to open the due list.
      if (typeof session === 'string' && session !== next) pending = null;
      session = next;
    },
    receive(event: unknown) {
      const id = reviewReminderId(event);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      if (seen.size > 100) seen.delete(seen.values().next().value!);
      pending = id;
      return true;
    },
    consume(routerReady: boolean): string | null {
      if (!ready || !session || !routerReady) return null;
      const id = pending;
      pending = null;
      return id;
    },
  };
}
