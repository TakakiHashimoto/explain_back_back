import { useAuth } from '@clerk/expo';
import { useEffect } from 'react';

import { notifications } from './onesignal';

export function NotificationIdentityBridge() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  // 1. Initialize the native OneSignal SDK.
  useEffect(() => {
    return notifications.initialize();
  }, []);

  // 2. Synchronize the authenticated user's identity.
  useEffect(() => {
    if (!isLoaded) return;

    // The user has signed out.
    if (!isSignedIn || !userId) {
      notifications.logout();
      return;
    }

    const controller = new AbortController();

    async function connectUser() {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error('Missing EXPO_PUBLIC_API_URL');
      }

      // Obtain a Clerk session token.
      const token = await getToken();

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
    };
  }, [isLoaded, isSignedIn, userId, getToken]);

  return null;
}
