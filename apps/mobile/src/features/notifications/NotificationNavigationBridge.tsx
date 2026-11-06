import { useAuth } from '@clerk/expo';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { notifications } from './onesignal';
import { createReviewReminderNavigation } from './reviewReminderNavigation';

export function NotificationNavigationBridge() {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const navigationState = useRootNavigationState();
  const router = useRouter();
  const [navigation] = useState(createReviewReminderNavigation);
  const [revision, setRevision] = useState(0);
  const session = !isLoaded ? undefined
    : isSignedIn && userId && sessionId ? `${userId}:${sessionId}` : null;

  useEffect(() => { navigation.setSession(session); }, [navigation, session]);

  // Register while Clerk is still loading so native cold-start click events can
  // wait for both authentication and the root navigator to become ready.
  useEffect(() => notifications.onClick((event) => {
    if (navigation.receive(event)) setRevision((value) => value + 1);
  }), [navigation]);

  useEffect(() => {
    const reminder = navigation.consume(!!navigationState?.key);
    if (reminder) {
      router.replace({ pathname: '/(tabs)/reviews', params: { reminder } });
    }
  }, [navigation, navigationState?.key, router, session, revision]);

  return null;
}
