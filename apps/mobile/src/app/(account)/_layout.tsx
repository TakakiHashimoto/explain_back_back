import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

/** Renders account routes (Profile, later Paywall) after Clerk loads, redirecting signed-out users to sign in. */
export default function AccountLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return <Stack />;
}
