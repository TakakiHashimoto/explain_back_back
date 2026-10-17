import { router, Stack } from 'expo-router';

export default function HomeStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index">
        <Stack.Title>Explain It Back</Stack.Title>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            // TODO this is just a placeholder
            icon={require('@/assets/images/icons/profile.png')}
            onPress={() => router.push('/profile')}
          >
            <Stack.Toolbar.Label>Profile</Stack.Toolbar.Label>
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}
