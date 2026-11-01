import { Tabs } from 'expo-router';
import { AppTabBar } from './app-tab-bar';

export default function AppTabs() {
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(home)" options={{ title: 'Home' }} />
      <Tabs.Screen name="topics" options={{ title: 'Topics' }} />
      <Tabs.Screen name="review" options={{ title: 'Review' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
    </Tabs>
    // =======
    //     <NativeTabs
    //       backgroundColor={colors.background}
    //       indicatorColor={colors.backgroundElement}
    //       labelStyle={{ selected: { color: colors.text } }}
    //     >
    //       <NativeTabs.Trigger name="index">
    //         <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
    //         <NativeTabs.Trigger.Icon
    //           src={require('@/assets/images/tabIcons/home.png')}
    //           renderingMode="template"
    //         />
    //       </NativeTabs.Trigger>
    //       <NativeTabs.Trigger name="reviews">
    //         <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
    //         <NativeTabs.Trigger.Icon sf="arrow.triangle.2.circlepath" md="sync" />
    //       </NativeTabs.Trigger>
    //     </NativeTabs>
    // >>>>>>> takaki/general-dev
  );
}
