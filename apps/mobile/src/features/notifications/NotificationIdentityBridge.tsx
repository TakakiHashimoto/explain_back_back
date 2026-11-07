import { useAuth } from '@clerk/expo';
import { useEffect, useRef } from 'react';

import { notifications } from './onesignal';

export function NotificationIdentityBridge() {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  // Clerk may return a new function on render; identity changes should follow
  // the account/session, rather than repeatedly logging the same device out.
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // 1. Initialize the native OneSignal SDK.
  useEffect(() => {
    return notifications.initialize();
  }, []);

  // 2. Synchronize the authenticated user's identity.
  useEffect(() => {
    if (!isLoaded) return;

    // A native identity can survive process death. Clear it before bootstrap so
    // a failed/expired session cannot leave a previous account attached.
    notifications.logout();

    // The user has signed out.
    if (!isSignedIn || !userId || !sessionId) {
      return;
    }

    const controller = new AbortController();

    async function connectUser() {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error('Missing EXPO_PUBLIC_API_URL');
      }

      // Obtain a Clerk session token.
      const token = await getTokenRef.current();

      if (!token) {
        throw new Error('Missing authentication token');
      }

      // Ask our backend which internal user this session belongs to.
      const response = await fetch(`${apiUrl}/api/v1/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`User bootstrap failed: HTTP ${response.status}`);
      }

      const data: unknown = await response.json();

      if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string') {
        throw new Error('Invalid user response');
      }

      // Avoid associating an outdated user after account changes.
      if (controller.signal.aborted) return;

      // The backend uses this exact ID when targeting notifications.
      notifications.login(data.id);
    }

    void connectUser().catch((error) => {
      if (!controller.signal.aborted) {
        console.warn('Notification identity connection failed', error);
      }
    });

    return () => {
      controller.abort();
      // Detach immediately, even if the next account's bootstrap later fails.
      notifications.logout();
    };
  }, [isLoaded, isSignedIn, userId, sessionId]);

  return null;
}
