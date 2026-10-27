import { useAuth, useClerk, useUser } from '@clerk/expo';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/** Displays the current user's email and a sign-out control, and bootstraps their backend account. */
export default function HomeScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  useEffect(() => {
    const bootstrapUser = async () => {
      try {
        console.log(process.env.EXPO_PUBLIC_API_URL);
        const token = await getToken();
        const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('/api/v1/me', res.status, await res.json());
      } catch (e) {
        console.warn('/api/v1/me failed', e);
      }
    };
    bootstrapUser();
  }, [getToken]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <ThemedText type="title" style={styles.title}>
            Explain It Back
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Signed in as"
            hint={<ThemedText type="code">{user?.primaryEmailAddress?.emailAddress}</ThemedText>}
          />
          <Pressable onPress={() => signOut()}>
            <ThemedText type="linkPrimary">Sign out</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
