import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

/** Renders the sign-in routes after Clerk loads, redirecting signed-in users to the tabs. */
export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
