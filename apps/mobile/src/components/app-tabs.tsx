import { Tabs } from 'expo-router';
import { AppTabBar } from './app-tab-bar';

export default function AppTabs() {
  return (
    <Tabs tabBar={() => <AppTabBar />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(home)" />
    </Tabs>
  );
}
