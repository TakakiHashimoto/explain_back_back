import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return <AppTabs />;
}
