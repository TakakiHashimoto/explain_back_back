import { Image, Pressable, Text, View } from 'react-native';
import { Icon } from './icon';

import { router } from 'expo-router';

type AppHeaderProps = {
  title: string;
};

export function AppHeader({ title }: AppHeaderProps) {
  return (
    <View className="bg-background shadow-card">
      <View className="self-center gap-sm px-margin py-sm w-full max-w-[600px] min-h-16 row-between">
        <View className="flex-1 min-w-0 row">
          <Image
            accessibilityLabel="Explain It Back App Icon"
            source={require('@/assets/images/logo.png')}
            className="w-8 h-8"
            resizeMode="contain"
          />
          <View className="flex-1 min-w-0">
            <Text className="headline-sm">Explain It Back</Text>
            {title ? <Text className="text-muted label-sm">{title}</Text> : null}
          </View>
        </View>
        <View className="row">
          <Pressable
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {}} // TODO
            className="justify-center items-center w-11 h-11"
          >
            <Icon name="notifications" size={22} />
          </Pressable>

          <Pressable
            accessibilityLabel="Profile"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push('/profile')}
            className="justify-center items-center active:opacity-60 w-11 h-11"
          >
            {/* TODO this is just a placeholder */}
            <Icon name="profile" size={24} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
