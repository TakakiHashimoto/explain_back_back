import { Pressable, View } from 'react-native';
import { useClerk, useUser } from '@clerk/expo';
import { ThemedText } from '@/components/themed-text';
import { dummyEntitlement } from '../data/dummy';

function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <View>
      <ThemedText>Profile</ThemedText>
      <View>
        <ThemedText>{user?.primaryEmailAddress?.emailAddress}</ThemedText>
        <ThemedText>Plan: {dummyEntitlement.isPro ? 'Pro' : 'Free'}</ThemedText>
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
