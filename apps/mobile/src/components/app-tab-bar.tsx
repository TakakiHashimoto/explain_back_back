import { Text, View } from 'react-native';
import { Icon } from './icon';

import { colors } from '@/styles/tokens';

const tabs = [
  { icon: 'home', label: 'Home' },
  { icon: 'topics', label: 'Topics' },
  { icon: 'mic', label: 'Speak' },
  { icon: 'review', label: 'Review' },
  { icon: 'progress', label: 'Progress' },
] as const;

export function AppTabBar() {
  return (
    <View className="px-margin py-sm">
      <View className="flex-row items-center self-center bg-surface shadow-floating px-sm rounded-full w-full max-w-[448px] min-h-16">
        {tabs.map(({ icon, label }) =>
          icon === 'mic' ? (
            <View
              key={icon}
              accessibilityLabel="Speak"
              className="justify-center items-center bg-primary shadow-floating mx-xs -mt-5 rounded-full w-[52px] h-[52px]"
            >
              <Icon name="mic" size={26} color={colors.onPrimary} />
            </View>
          ) : (
            <View
              key={icon}
              className="flex-1 justify-center items-center gap-0.5 min-h-16"
              accessibilityLabel={icon === 'review' ? 'Review, 3 items' : label}
            >
              <View>
                <Icon
                  name={icon}
                  size={22}
                  color={icon === 'review' ? colors.primary : colors.textMuted}
                />
                {icon === 'review' && (
                  <View className="-top-1 -right-2 absolute justify-center items-center bg-danger rounded-full w-4 h-4">
                    <Text className="text-[10px] text-on-primary leading-[12px] label-sm">3</Text>
                  </View>
                )}
              </View>
              <Text className={`label-sm ${icon === 'review' ? 'text-primary' : 'text-muted'}`}>
                {label}
              </Text>
            </View>
          ),
        )}
      </View>
    </View>
  );
}
