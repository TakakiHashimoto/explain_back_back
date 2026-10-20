import { useAuth, useUser } from '@clerk/expo';
import { styled } from 'nativewind';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { UsageSummaryCard } from '@/features/usage/components/UsageSummaryCard';
import { apiFetch } from '@/lib/api-fetch';
import { AppHeader } from '@/components/app-header';
import { AppTabBar } from '@/components/app-tab-bar';

// SafeAreaView is a third-party component, so explicitly enable className.
const StyledSafeAreaView = styled(SafeAreaView);

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Home dashboard (design "Home"); also bootstraps the user's backend account. */
export default function HomeScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    const bootstrapUser = async () => {
      try {
        await apiFetch('/api/v1/me', getToken);
      } catch (e) {
        console.warn('/api/v1/me failed', e);
      }
    };
    bootstrapUser();
  }, [getToken]);

  const name = user?.firstName;

  return (
    <StyledSafeAreaView className="app-shell" edges={['top', 'left', 'right']}>
      <AppHeader title="" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="w-full max-w-[600px] self-center gap-md px-margin pt-lg"
        contentContainerStyle={{ paddingBottom: BottomTabInset + 20 }}
      >
        <View className="gap-xs">
          <Text className="text-muted uppercase tracking-[0.9px] label-sm">
            {greeting(new Date().getHours())}
            {name ? `, ${name}` : ''}
          </Text>
          <Text className="display-lg-mobile">What did you learn today?</Text>
        </View>
        <Text className="h-[100px] card">Dummy</Text>
        <Text className="h-[100px] card">Dummy</Text>
        <UsageSummaryCard />
        <Text className="h-[500px] card">Dummy</Text>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
