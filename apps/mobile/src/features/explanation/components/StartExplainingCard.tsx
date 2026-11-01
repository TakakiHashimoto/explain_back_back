import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { colors } from '@/styles/tokens';
import { MAX_RECORDING_SEC } from '../recording/recordingOptions';

/** Home entry point to the recording screen (design Home "Explain a concept out loud"). */
export function StartExplainingCard() {
  return (
    <View testID="start-explaining-card" className="gap-[14px] p-5 rounded-[20px] card">
      <View className="gap-[6px]">
        <Text className="headline-sm">Explain a concept out loud</Text>
        <Text className="body-md text-text-secondary">
          Talk for up to {MAX_RECORDING_SEC / 60} minutes as if teaching a friend. We’ll show what you got right,
          what you missed, and what you got subtly wrong.
        </Text>
      </View>
      <Pressable
        testID="start-explaining-button"
        className="btn-primary"
        accessibilityRole="button"
        onPress={() => router.push('/record')}
      >
        <Icon name="mic" size={20} color={colors.onPrimary} />
        <Text className="btn-primary-text">Start explaining</Text>
      </Pressable>
    </View>
  );
}
