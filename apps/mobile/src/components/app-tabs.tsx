import { Tabs } from 'expo-router';
import { AppTabBar } from './app-tab-bar';

export default function AppTabs() {
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(home)" options={{ title: 'Home' }} />
      <Tabs.Screen name="topics" options={{ title: 'Topics' }} />
      <Tabs.Screen name="mic" options={{ title: 'Speak' }} />
      <Tabs.Screen name="review" options={{ title: 'Review' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
    </Tabs>
  );
}
