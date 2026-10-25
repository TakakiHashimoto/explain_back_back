import { Text, View } from 'react-native';
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
  mic: 'mic',
};

export function AppTabBar(props: TabBarProps) {
  const tabs = props.state.routes.map((route) => {
    const icon = routeIcons[route.name];

    if (__DEV__ && !icon) {
      console.warn(`AppTabBar: no icon for route "${route.name}". Add it to routeIcons.`);
    }

    return {
      route,
      icon,
      label: props.descriptors[route.key].options.title ?? route.name,
    };
  });

  return (
    <View className="px-margin py-sm">
      <View className="flex-row items-center self-center bg-surface shadow-floating px-sm rounded-full w-full max-w-[448px] min-h-16">
        {tabs.map(({ route, icon, label }, index) =>
          icon === 'mic' ? (
            <View
              key={route.name}
              accessibilityLabel="Speak"
              className="justify-center items-center bg-primary shadow-floating mx-xs -mt-5 rounded-full w-[52px] h-[52px]"
            >
              <Icon name="mic" size={26} color={colors.onPrimary} />
            </View>
          ) : (
            <View
              key={route.name}
              className="flex-1 justify-center items-center gap-0.5 min-h-16"
              accessibilityLabel={icon === 'review' ? 'Review, 3 items' : label}
            >
              <View>
                {icon && (
                  <Icon
                    name={icon}
                    size={22}
                    color={props.state.index === index ? colors.primary : colors.textMuted}
                  />
                )}
                {icon === 'review' && (
                  <View className="-top-1 -right-2 absolute justify-center items-center bg-danger rounded-full w-4 h-4">
                    <Text className="text-[10px] text-on-primary leading-[12px] label-sm">3</Text>
                  </View>
                )}
              </View>
              <Text
                className={`label-sm ${props.state.index === index ? 'text-primary' : 'text-muted'}`}
              >
                {label}
              </Text>
            </View>
          ),
        )}
      </View>
    </View>
  );
}
