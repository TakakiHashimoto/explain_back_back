import { expect, test } from 'bun:test';
import { createReviewReminderNavigation, reviewReminderId } from './reviewReminderNavigation';

const click = (id = 'notification-1') => ({ notification: {
  notificationId: id, additionalData: { type: 'due_review_reminder' },
} });

test.each([null, {}, { notification: {} }, { notification: { notificationId: 'id' } },
  { notification: { notificationId: 'id', additionalData: { type: 'other' } } },
  { notification: { notificationId: '', additionalData: { type: 'due_review_reminder' } } },
])('ignores malformed, unrelated and old untyped notifications %#', (event) => {
  expect(reviewReminderId(event)).toBeNull();
});

test('cold-start click waits for both Clerk hydration and router readiness', () => {
  const navigation = createReviewReminderNavigation();
  navigation.receive(click());
  expect(navigation.consume(true)).toBeNull();
  navigation.setSession('user-a:session-a');
  expect(navigation.consume(false)).toBeNull();
  expect(navigation.consume(true)).toBe('notification-1');
  expect(navigation.consume(true)).toBeNull();
});

test('signed-out launch waits for sign-in without trusting payload identity or URL', () => {
  const navigation = createReviewReminderNavigation();
  navigation.setSession(null);
  navigation.receive({ notification: { ...click().notification,
    additionalData: { type: 'due_review_reminder', userId: 'other-user', url: '/admin' },
  } });
  expect(navigation.consume(true)).toBeNull();
  navigation.setSession('authenticated-user:session');
  expect(navigation.consume(true)).toBe('notification-1');
});

test.each([null, 'user-b:session-b', 'user-a:renewed-session'])('session change %s discards pending navigation', (next) => {
  const navigation = createReviewReminderNavigation();
  navigation.setSession('user-a:session-a');
  navigation.receive(click());
  navigation.setSession(undefined);
  expect(navigation.consume(true)).toBeNull();
  navigation.setSession(next);
  navigation.setSession('user-b:session-b');
  expect(navigation.consume(true)).toBeNull();
});

test('running-app taps consume once, deduplicate redelivery and accept later reminders', () => {
  const navigation = createReviewReminderNavigation();
  navigation.setSession('user-a:session-a');
  expect(navigation.receive(click())).toBe(true);
  expect(navigation.consume(true)).toBe('notification-1');
  expect(navigation.receive(click())).toBe(false);
  expect(navigation.consume(true)).toBeNull();
  navigation.receive(click('notification-2'));
  expect(navigation.consume(true)).toBe('notification-2');
});
