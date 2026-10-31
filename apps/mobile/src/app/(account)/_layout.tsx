import { Stack } from 'expo-router';

/** Renders account routes (Profile, Paywall) */
export default function AccountLayout() {
  return (
    <Stack>
      {/* Paywall renders its own top bar (Close + Restore) to match the design. */}
      <Stack.Screen
        name="paywall"
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
    </Stack>
  );
}
