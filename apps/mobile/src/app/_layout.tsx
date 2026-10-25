import '@/globals.css';

import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
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

/** Renders nested routes with Clerk authentication, token caching, and the active color theme. */
export default function TabLayout() {
  const colorScheme = useColorScheme();
  useEffect(() => notifications.initialize(), []);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : LightTheme}>
        <Slot />
      </ThemeProvider>
    </ClerkProvider>
  );
}
