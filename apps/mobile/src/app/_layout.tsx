import '@/globals.css';

import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { notifications } from '@/features/notifications/onesignal';
import { colors } from '@/styles/tokens';

// Navigator containers and screens without `app-shell` use the theme background; match the design token.
const LightTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background },
};

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

if (!publishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add your key to .env.local.\nRun: 1) clerk auth login  2) clerk link  3) clerk env pull — then restart the dev server.',
  );
}

/** Declares which route groups are reachable for the current auth state. */
function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={!!isSignedIn}>
        {/* NOTE: the order matters. `tabs` needs to come first */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(account)" />
        <Stack.Screen name="(protected)" />
      </Stack.Protected>
    </Stack>
  );
}

/** Renders nested routes with Clerk authentication, token caching, and the light theme. */
export default function RootLayout() {
  useEffect(() => notifications.initialize(), []);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ThemeProvider value={LightTheme}>
        <RootNavigator />
      </ThemeProvider>
    </ClerkProvider>
  );
}
