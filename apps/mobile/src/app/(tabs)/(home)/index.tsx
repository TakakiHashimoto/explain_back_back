import { useUser } from '@clerk/expo';
import { styled } from 'nativewind';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { StartExplainingCard } from '@/features/explanation/components/StartExplainingCard';
import { UsageSummaryCard } from '@/features/usage/components/UsageSummaryCard';
import { AppHeader } from '@/components/app-header';
import { TAB_BAR_HEIGHT } from '@/components/app-tab-bar';

// SafeAreaView is a third-party component, so explicitly enable className.
const StyledSafeAreaView = styled(SafeAreaView);

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Home dashboard (design "Home") */
export default function HomeScreen() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  const name = user?.firstName;

  return (
    <StyledSafeAreaView testID="screen-home" className="app-shell" edges={['top', 'left', 'right']}>
      <AppHeader title="" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="w-full max-w-[600px] self-center gap-md px-margin pt-lg"
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20 }}
      >
        <View className="gap-xs">
          <Text className="text-muted uppercase tracking-[0.9px] label-sm">
            {greeting(new Date().getHours())}
            {name ? `, ${name}` : ''}
          </Text>
          <Text className="display-lg-mobile">What did you learn today?</Text>
        </View>
        <StartExplainingCard />
        <Text className="h-[100px] card">Dummy</Text>
        <UsageSummaryCard />
        <Text className="h-[500px] card">Dummy</Text>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
