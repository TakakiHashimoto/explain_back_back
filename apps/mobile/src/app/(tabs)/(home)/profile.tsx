import { useAuth, useClerk, useUser } from '@clerk/expo';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Entitlement } from '@/features/usage/types';
import { getEntitlement } from '@/features/usage/api/api.usage';
import { UsageMeter } from '@/features/usage/components/UsageSummaryCard';
import { Icon } from '@/components/icon';
import { TAB_BAR_HEIGHT } from '@/components/app-tab-bar';
import { colors } from '@/styles/tokens';

type State =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; entitlement: Entitlement };

/** Uppercase section title above a card or list (design "eyebrow"). */
function SectionLabel({ children }: { children: string }) {
  return <Text className="pl-xs text-muted uppercase tracking-[0.9px] label-sm">{children}</Text>;
}

type SettingsRowProps = {
  label: string;
  value?: string;
  onPress?: () => void;
  isFirst?: boolean;
};

/** One tappable row in a settings list: label, optional value and a chevron. */
function SettingsRow({ label, value, onPress, isFirst }: SettingsRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`list-row min-h-[52px] active:bg-background ${isFirst ? '' : 'list-row-divider'}`}
    >
      <Text className="body-md">{label}</Text>
      <View className="row">
        {value ? <Text className="text-muted body-md">{value}</Text> : null}
        <Icon name="chevron" size={18} color={colors.placeholder} />
      </View>
    </Pressable>
  );
}

/** Profile & settings (design "Profile & settings — Free (scrolled)"). */
export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ status: 'loading' });
  // TODO: persist and schedule reminders; local state only for now.
  const [remindersOn, setRemindersOn] = useState(true);
  // Only the hour and minute are used; the date part is ignored.
  const [reminderTime, setReminderTime] = useState(() => new Date(2000, 0, 1, 20, 0));
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  const { getToken } = useAuth();

  useEffect(() => {
    let cancelled = false;
    getEntitlement(getToken)
      .then((entitlement) => {
        if (!cancelled) setState({ status: 'success', entitlement });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  if (state.status === 'loading') {
    return <Text className="text-muted body-sm">Loading setting...</Text>;
  }
  if (state.status === 'error') {
    return <Text className="text-muted body-sm">Failed to load setting</Text>;
  }

  const { isPro, usage } = state.entitlement;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const email = user?.primaryEmailAddress?.emailAddress;
  const initial = (fullName || email || '?').charAt(0).toUpperCase();
  const resetDays = usage.windowEnd
    ? Math.ceil((new Date(usage.windowEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <>
      <Stack.Title>Profile</Stack.Title>
      <ScrollView
        className="app-shell"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="w-full max-w-[600px] self-center gap-[18px] px-margin pt-lg"
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20 }}
      >
        {/* Identity */}
        <View className="flex-row items-center gap-[14px]">
          <View className="justify-center items-center bg-primary-soft rounded-full w-14 h-14">
            <Text className="font-sans font-bold text-[22px] text-primary-lip">{initial}</Text>
          </View>
          <View className="flex-1 gap-[2px] min-w-0">
            {fullName ? <Text className="headline-sm">{fullName}</Text> : null}
            {email ? <Text className="text-muted body-sm">{email}</Text> : null}
          </View>
          {isPro ? (
            <View className="bg-primary px-[10px] py-[3px] border border-primary rounded-full">
              <Text className="font-sans font-bold text-[12px] text-on-primary leading-[16px]">
                Pro
              </Text>
            </View>
          ) : (
            <View className="bg-surface-muted px-[10px] py-[3px] border border-border rounded-full">
              <Text className="font-sans font-bold text-[12px] text-text-secondary leading-[16px]">
                Free
              </Text>
            </View>
          )}
        </View>

        {/* This week's usage */}
        <View className="gap-[14px] card">
          <View className="row-between">
            <Text className="text-muted uppercase tracking-[0.9px] label-sm">
              This week’s usage
            </Text>
            {resetDays && <Text className="text-muted body-sm">Resets in {resetDays} days</Text>}
          </View>
          {/* UsageMeter is flex-1, so wrap each in a row to keep it from collapsing in a column. */}
          <View className="flex-row">
            <UsageMeter label="Analyses" used={usage.analyses.used} limit={usage.analyses.limit} />
          </View>
          <View className="flex-row">
            <UsageMeter label="Reviews" used={usage.reviews.used} limit={usage.reviews.limit} />
          </View>
          {!isPro && (
            // TODO: navigate to the Paywall once its route exists.
            <Pressable accessibilityRole="button" onPress={() => {}} className="btn-primary">
              <Text className="btn-primary-text">Upgrade to Pro</Text>
            </Pressable>
          )}
        </View>

        {/* Reminders */}
        <View className="gap-sm">
          <SectionLabel>Reminders</SectionLabel>
          <View className="overflow-hidden list">
            <View className="min-h-[52px] list-row">
              <Text className="body-md">Review reminders</Text>
              <Switch
                accessibilityLabel="Review reminders"
                value={remindersOn}
                onValueChange={setRemindersOn}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
            <SettingsRow
              label="Reminder time"
              value={reminderTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              onPress={() => setIsTimePickerOpen((open) => !open)}
            />
            {/* Android opens a dialog on mount and expects us to unmount it on confirm/cancel.
                iOS renders it inline below the row (and fires on every wheel change), so it stays
                open until the row is tapped again. Web renders nothing. */}
            {isTimePickerOpen && (
              <DateTimePicker
                mode="time"
                value={reminderTime}
                accentColor={colors.primary}
                onValueChange={(_event, date) => {
                  setReminderTime(date);
                  if (Platform.OS === 'android') setIsTimePickerOpen(false);
                }}
                onDismiss={() => setIsTimePickerOpen(false)}
              />
            )}
          </View>
        </View>

        {/* Subscription */}
        <View className="gap-sm">
          <SectionLabel>Subscription</SectionLabel>
          <View className="overflow-hidden list">
            {/* TODO: wire to RevenueCat (Phase 4). */}
            <SettingsRow label="Manage subscription" isFirst />
            <SettingsRow label="Restore purchases" />
          </View>
        </View>

        {/* Account */}
        <View className="gap-sm">
          <SectionLabel>Account</SectionLabel>
          <View className="overflow-hidden list">
            {/* TODO: destination screens. */}
            <SettingsRow label="Privacy & recordings" isFirst />
            <SettingsRow label="Help & feedback" />
            <Pressable
              accessibilityRole="button"
              onPress={() => signOut()}
              className="active:bg-background min-h-[52px] list-row list-row-divider"
            >
              <Text className="font-semibold text-danger-text body-md">Sign out</Text>
            </Pressable>
          </View>
        </View>

        {/* `expoConfig.version` comes from app.config.ts, which copies package.json's version. */}
        <Text className="text-[12px] text-muted text-center body-sm">
          Explain It Back · v{Constants.expoConfig?.version}
        </Text>
      </ScrollView>
    </>
  );
}
