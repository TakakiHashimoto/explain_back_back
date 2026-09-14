import { AuthView } from '@clerk/expo/native';
import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';

/** Renders Clerk's non-dismissible native authentication flow. */
export default function SignInScreen() {
  return (
    <ThemedView style={styles.container}>
      <AuthView isDismissible={false} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
