import { Pressable, Text, View } from 'react-native';
import { Icon } from './icon';
import type { ComponentProps } from 'react';
import type { Tabs } from 'expo-router';

import { colors } from '@/styles/tokens';

type TabsProps = ComponentProps<typeof Tabs>;
type TabBarRenderer = NonNullable<TabsProps['tabBar']>;
type TabBarProps = Parameters<TabBarRenderer>[0];

const routeIcons: Partial<Record<string, ComponentProps<typeof Icon>['name']>> = {
  '(home)': 'home',
  topics: 'topics',
  review: 'review',
  progress: 'progress',
};

export const TAB_BAR_HEIGHT = 64 + 8; // min-h-16 + pt-sm

export function AppTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const tabs = state.routes.map((route) => {
    const icon = routeIcons[route.name];

    if (__DEV__ && !icon) {
      console.warn(`AppTabBar: no icon for route "${route.name}". Add it to routeIcons.`);
    }

    return {
      route,
      icon,
      label: descriptors[route.key].options.title ?? route.name,
    };
  });

  type Tab = (typeof tabs)[number];
  const renderTab = ({ route, icon, label }: Tab) => {
    const isFocused = state.routes[state.index].key === route.key;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    return (
      <Pressable
        key={route.name}
        className="flex-1 justify-center items-center gap-0.5 min-h-16"
        accessibilityLabel={icon === 'review' ? 'Review, 3 items' : label}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={isFocused ? { selected: true } : {}}
      >
        {icon && (
          <Icon name={icon} size={22} color={isFocused ? colors.primary : colors.textMuted} />
        )}
        {icon === 'review' && (
          <View className="-top-1 -right-2 absolute justify-center items-center bg-danger rounded-full w-4 h-4">
            <Text className="text-[10px] text-on-primary leading-[12px] label-sm">3</Text>
          </View>
        )}
        <Text className={`label-sm ${isFocused ? 'text-primary' : 'text-muted'}`}>{label}</Text>
      </Pressable>
    );
  };

  const mid = Math.ceil(tabs.length / 2);

  const leftTabs = tabs.slice(0, mid);
  const rightTabs = tabs.slice(mid);

  return (
    <View
      className="bottom-0 absolute inset-x-0 px-margin pt-sm"
      style={{ paddingBottom: insets.bottom + 8 }}
      pointerEvents="box-none"
    >
      <View
        className="flex-row items-center self-center bg-surface shadow-floating px-sm rounded-full w-full max-w-[448px] min-h-16"
        accessibilityRole="tablist"
      >
        {leftTabs.map(renderTab)}
        <Pressable
          key="mic"
          accessibilityLabel="Speak"
          accessibilityRole="button"
          className="justify-center items-center bg-primary shadow-floating mx-xs -mt-5 rounded-full w-[52px] h-[52px]"
          onPress={() => {}} // TODO record function
        >
          <Icon name="mic" size={26} color={colors.onPrimary} />
        </Pressable>
        {rightTabs.map(renderTab)}
      </View>
    </View>
  );
}
