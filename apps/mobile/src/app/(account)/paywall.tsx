import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icon';
import { getEntitlement } from '@/features/usage/api/api.usage';
import { Entitlement } from '@/features/usage/types';
import { colors } from '@/styles/tokens';

type PlanId = 'yearly' | 'monthly';

// Per 7-day window, from docs/free-pro/README.md.
const COMPARISON = [
  { label: 'Analyses', free: '3', pro: '20' },
  { label: 'Reviews', free: '18', pro: '120' },
  { label: 'Follow-up questions', free: 'Yes', pro: 'Yes' },
  { label: 'Review reminders', free: 'Yes', pro: 'Yes' },
];

// TODO: replace with the RevenueCat offering's prices (Phase 4). The yearly price is only an example.
const PLANS: { id: PlanId; label: string; price: string; badge?: string }[] = [
  { id: 'yearly', label: 'Yearly', price: '¥7,800 / year', badge: 'Best value' },
  { id: 'monthly', label: 'Monthly', price: '¥980 / month' },
];

type ComparisonRowProps = {
  label: string;
  free: string;
  pro: string;
  isFirst?: boolean;
};

/** One row of the Free / Pro table; the Pro column is tinted. */
function ComparisonRow({ label, free, pro, isFirst }: ComparisonRowProps) {
  return (
    <View className={`flex-row ${isFirst ? '' : 'list-row-divider'}`}>
      <Text className="flex-1 px-[14px] py-[11px] font-sans font-medium text-[14px] text-text-secondary leading-[20px]">
        {label}
      </Text>
      <Text className="py-[11px] w-[72px] font-sans font-bold tabular-nums text-[14px] text-text text-center leading-[20px]">
        {free}
      </Text>
      <Text className="bg-primary-soft py-[11px] w-[72px] font-sans font-bold tabular-nums text-[14px] text-primary-lip text-center leading-[20px]">
        {pro}
      </Text>
    </View>
  );
}

type PlanOptionProps = {
  label: string;
  price: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
};

/** A radio-style plan card. The 1px border gets 1px more padding so both states have the same size. */
function PlanOption({ label, price, badge, selected, onPress }: PlanOptionProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`flex-row items-center gap-[14px] bg-surface rounded-lg ${
        selected
          ? 'border-2 border-primary px-md py-[14px]'
          : 'border border-border px-[17px] py-[15px]'
      }`}
    >
      <View
        className={`justify-center items-center rounded-full w-[22px] h-[22px] ${
          selected ? 'bg-primary' : 'border-2 border-placeholder'
        }`}
      >
        {selected && <View className="bg-surface rounded-full w-[10px] h-[10px]" />}
      </View>
      <View className="flex-1 gap-[2px]">
        <Text className="font-sans font-bold text-[15px] text-text leading-[22px]">{label}</Text>
        <Text className="text-muted body-sm">{price}</Text>
      </View>
      {badge && (
        <View className="bg-text px-sm py-[3px] rounded-full">
          <Text className="font-sans font-bold text-[11px] text-on-primary leading-[14px] tracking-[0.4px]">
            {badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Paywall (design "Paywall (limit reached)"). UI only; purchases come with RevenueCat. */
export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [plan, setPlan] = useState<PlanId>('yearly');
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The usage notes are optional, so a failed fetch just leaves them hidden.
    getEntitlement(getToken)
      .then((result) => {
        if (!cancelled) setEntitlement(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  // Profile can open the Paywall before the limit, so the limit notes show only when it is reached.
  const usage = entitlement?.usage;
  const isLimitReached = !!usage && usage.analyses.used >= usage.analyses.limit;
  const resetDays = usage?.windowEnd
    ? Math.ceil((new Date(usage.windowEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;
  const reviewsLeft = usage ? Math.max(usage.reviews.limit - usage.reviews.used, 0) : 0;

  return (
    <View className="app-shell" style={{ paddingTop: insets.top }}>
      <View className="flex-row justify-between items-center px-sm py-[6px] min-h-14">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          className="justify-center items-center active:bg-surface-muted rounded-full w-11 h-11"
        >
          <Icon name="close" size={22} color={colors.textSecondary} />
        </Pressable>
        {/* TODO: restore purchases via RevenueCat (Phase 4). */}
        <Pressable accessibilityRole="button" onPress={() => {}} className="p-3">
          <Text className="font-sans font-semibold text-[14px] text-primary leading-[20px]">
            Restore
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="w-full max-w-[600px] self-center gap-[18px] px-margin"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Heading */}
        <View className="gap-[12px]">
          {isLimitReached && (
            <View className="chip-warning">
              <View className="bg-warning-text rounded-full w-[6px] h-[6px]" />
              <Text className="chip-warning-text">
                {usage.analyses.used} of {usage.analyses.limit} analyses used this week
              </Text>
            </View>
          )}
          <Text
            accessibilityRole="header"
            className="font-sans font-extrabold text-[30px] text-text leading-[36px] tracking-[-0.8px]"
          >
            Keep explaining with Pro
          </Text>
          <Text className="text-secondary body-md">
            More analyses and reviews every week, so you can work through a whole course, not just
            one topic.
          </Text>
        </View>

        {/* Free / Pro comparison */}
        <View className="overflow-hidden list">
          <View className="flex-row bg-surface-muted">
            <Text className="flex-1 px-[14px] py-[11px] text-muted uppercase tracking-[0.9px] label-sm">
              Per week
            </Text>
            <Text className="py-[11px] w-[72px] text-muted text-center uppercase tracking-[0.9px] label-sm">
              Free
            </Text>
            <Text className="bg-primary-soft py-[11px] w-[72px] text-primary-lip text-center uppercase tracking-[0.9px] label-sm">
              Pro
            </Text>
          </View>
          {COMPARISON.map((row, index) => (
            <ComparisonRow key={row.label} {...row} isFirst={index === 0} />
          ))}
        </View>

        {/* Plans */}
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Choose a plan"
          className="gap-[10px]"
        >
          {PLANS.map(({ id, ...option }) => (
            <PlanOption key={id} {...option} selected={plan === id} onPress={() => setPlan(id)} />
          ))}
        </View>

        <View className="gap-[10px]">
          {/* TODO: purchase the selected plan via RevenueCat (Phase 4). */}
          <Pressable accessibilityRole="button" onPress={() => {}} className="btn-primary">
            <Text className="btn-primary-text">Continue</Text>
          </Pressable>
          <Text className="text-muted text-center body-sm">
            Cancel anytime in your store settings.
          </Text>
        </View>

        {isLimitReached && resetDays !== null && (
          <View className="bg-surface-muted px-[12px] py-[10px] rounded-md">
            <Text className="text-muted text-center body-sm">
              Not now? Your free analyses come back in{' '}
              <Text className="font-bold text-text">
                {resetDays} {resetDays === 1 ? 'day' : 'days'}
              </Text>
              . Reviews are still open:{' '}
              <Text className="font-bold text-text">{reviewsLeft} left</Text>.
            </Text>
          </View>
        )}

        {/* TODO: open the Terms and Privacy pages. */}
        <View className="flex-row justify-center items-center gap-xs">
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => {}}>
            <Text className="text-[12px] text-primary body-sm">Terms</Text>
          </Pressable>
          <Text className="text-[12px] text-muted body-sm">·</Text>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => {}}>
            <Text className="text-[12px] text-primary body-sm">Privacy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
