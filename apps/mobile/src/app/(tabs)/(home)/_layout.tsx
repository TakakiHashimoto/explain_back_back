import { Stack } from 'expo-router';

export default function HomeStackLayout() {
  return (
    <Stack>
      {/* Home renders its own header (HomeHeader) to match the design. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
