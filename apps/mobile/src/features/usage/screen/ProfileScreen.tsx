import { Pressable, View } from 'react-native';
import { useClerk, useUser } from '@clerk/expo';
import { ThemedText } from '@/components/themed-text';
import type { Usage } from '../types';

const dummyUsage: Usage = {
  isPro: false,
  usage: { analyses: { used: 2, limit: 3 }, reviews: { used: 2, limit: 3 } },
};

function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <View>
      <ThemedText>Profile</ThemedText>
      <View>
        <ThemedText>{user?.primaryEmailAddress?.emailAddress}</ThemedText>
        <ThemedText>Plan: {dummyUsage.isPro ? 'Pro' : 'Free'}</ThemedText>
        <ThemedText>
          Analyses: {dummyUsage.usage.analyses.used} / {dummyUsage.usage.analyses.limit}
        </ThemedText>
        <ThemedText>
          Reviews: {dummyUsage.usage.reviews.used} / {dummyUsage.usage.reviews.limit}
        </ThemedText>
      </View>
      <View>
        <Pressable onPress={() => signOut()}>
          <ThemedText type="linkPrimary">Sign out</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export default ProfileScreen;
