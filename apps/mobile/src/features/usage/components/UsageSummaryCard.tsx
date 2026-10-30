import { useAuth } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/styles/tokens';
import { getEntitlement } from '../api/api.usage';
import { Entitlement } from '../types';

import { dummyEntitlement } from '../data/dummy';

type State =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; entitlement: Entitlement };

type UsageMeterProps = {
  label: string;
  used: number;
  limit: number;
};

/** Linearly blends two `#rrggbb` colors; `t` = 0 returns `from`, 1 returns `to`. */
function mixColor(from: string, to: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2]
    .map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t))
    .join(', ')})`;
}

/** One usage column: label, "used / limit" and a progress bar that shifts from primary to warning as it fills. */
export function UsageMeter({ label, used, limit }: UsageMeterProps) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 1;

  return (
    <View className="flex-1 gap-[6px] min-w-0">
      <View className="flex-row justify-between">
        <Text className="font-sans text-[13px] text-text-secondary leading-[18px]">{label}</Text>
        <Text className="font-sans font-bold tabular-nums text-[13px] text-text leading-[18px]">
          {used} / {limit}
        </Text>
      </View>
      <View
        className="bg-divider rounded-full h-2 overflow-hidden"
        accessibilityRole="progressbar"
        accessibilityLabel={`${used} of ${limit} ${label.toLowerCase()} used`}
      >
        <View
          className="rounded-full h-full"
          style={{
            width: `${ratio * 100}%`,
            backgroundColor: mixColor(colors.primary, colors.warning, ratio),
          }}
        />
      </View>
    </View>
  );
}

/** Shows the current plan and this window's analysis / review usage (Home, design "Free plan · this week"). */
export function UsageSummaryCard() {
  const [state, setState] = useState<State>({ status: 'loading' });

  const { getToken } = useAuth();

  useEffect(() => {
    // Skip state updates when the component unmounts before the request finishes.
    let cancelled = false;
    getEntitlement(getToken)
      .then((entitlement) => {
        if (!cancelled) setState({ status: 'success', entitlement });

        // STUB
        setState({ status: 'success', entitlement: dummyEntitlement });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  if (state.status === 'loading') {
    return <Text className="text-muted body-sm">Loading usage...</Text>;
  }
  if (state.status === 'error') {
    return <Text className="text-muted body-sm">Failed to load usage</Text>;
  }

  const { isPro, usage } = state.entitlement;

  return (
    <View className="gap-[10px] card-muted">
      <View className="flex-row justify-between items-center">
        <Text className="font-sans font-bold text-[11px] text-text-muted uppercase leading-[14px] tracking-[0.9px]">
          {isPro ? 'Pro' : 'Free'} plan · this week
        </Text>
        {/* TODO: make this a link to the paywall once the route exists (Phase 4). */}
        {!isPro && (
          <Text className="font-sans font-semibold text-[13px] text-primary leading-[18px]">
            Upgrade
          </Text>
        )}
      </View>
      <View className="flex-row gap-md">
        <UsageMeter label="Analyses" used={usage.analyses.used} limit={usage.analyses.limit} />
        <UsageMeter label="Reviews" used={usage.reviews.used} limit={usage.reviews.limit} />
      </View>
    </View>
  );
}
