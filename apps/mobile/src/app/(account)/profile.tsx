import { useAuth, useClerk, useUser } from '@clerk/expo';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import Constants from 'expo-constants';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Entitlement } from '@/features/usage/types';
import { getEntitlement } from '@/features/usage/api/api.usage';
import { UsageMeter } from '@/features/usage/components/UsageSummaryCard';
import { notifications } from '@/features/notifications/onesignal';
import { Icon } from '@/components/icon';
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
  testID?: string;
};

/** One tappable row in a settings list: label, optional value and a chevron. */
function SettingsRow({ label, value, onPress, isFirst, testID }: SettingsRowProps) {
  return (
    <Pressable
      testID={testID}
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

const MINUTES_PER_DAY = 24 * 60;

/** "Resets in N days" from a day out, "Resets in h:mm" under that; null once it has passed. */
function formatResetIn(minutesLeft: number): string | null {
  if (minutesLeft <= 0) return null;
  if (minutesLeft >= MINUTES_PER_DAY) {
    const days = Math.ceil(minutesLeft / MINUTES_PER_DAY);
    return `Resets in ${days} ${days === 1 ? 'day' : 'days'}`;
  }
  const hours = Math.floor(minutesLeft / 60);
  const minutes = String(minutesLeft % 60).padStart(2, '0');
  return `Resets in ${hours}:${minutes}`;
}

type ProfileContentProps = {
  entitlement: Entitlement;
  /** Time the screen was last focused; the reset countdown is computed from it. */
  now: number;
};

/** Identity, usage and settings sections, shown once the entitlement has loaded. */
function ProfileContent({ entitlement, now }: ProfileContentProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  // Mirrors this device's push opt-in; turning it on is where we ask for notification permission.
  const [remindersOn, setRemindersOn] = useState(false);
  // Only the hour and minute are used; the date part is ignored.
  const [reminderTime, setReminderTime] = useState(() => new Date(2000, 0, 1, 20, 0));
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    notifications
      .isOptedIn()
      .then((optedIn) => {
        if (!cancelled) setRemindersOn(optedIn);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ON asks for permission (or offers the settings when it was denied); the switch shows the result.
  const onRemindersChange = (on: boolean) => {
    if (!on) {
      notifications.disable();
      setRemindersOn(false);
      return;
    }
    notifications
      .enable()
      .then(setRemindersOn)
      .catch(() => setRemindersOn(false));
  };

  const { isPro, usage } = entitlement;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const email = user?.primaryEmailAddress?.emailAddress;
  const initial = (fullName || email || '?').charAt(0).toUpperCase();
  const resetLabel = usage.windowEnd
    ? formatResetIn(Math.ceil((new Date(usage.windowEnd).getTime() - now) / (60 * 1000)))
    : null;

  return (
    <>
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
          <View
            testID="profile-plan-badge"
            className="bg-primary px-[10px] py-[3px] border border-primary rounded-full"
          >
            <Text className="font-sans font-bold text-[12px] text-on-primary leading-[16px]">
              Pro
            </Text>
          </View>
        ) : (
          <View
            testID="profile-plan-badge"
            className="bg-surface-muted px-[10px] py-[3px] border border-border rounded-full"
          >
            <Text className="font-sans font-bold text-[12px] text-text-secondary leading-[16px]">
              Free
            </Text>
          </View>
        )}
      </View>

      {/* This week's usage */}
      <View className="gap-[14px] card">
        <View className="row-between">
          <Text className="text-muted uppercase tracking-[0.9px] label-sm">This week’s usage</Text>
          {resetLabel && <Text className="text-muted body-sm">{resetLabel}</Text>}
        </View>
        {/* UsageMeter is flex-1, so wrap each in a row to keep it from collapsing in a column. */}
        <View className="flex-row">
          <UsageMeter
            testID="profile-usage-analyses"
            label="Analyses"
            used={usage.analyses.used}
            limit={usage.analyses.limit}
          />
        </View>
        <View className="flex-row">
          <UsageMeter
            testID="profile-usage-reviews"
            label="Reviews"
            used={usage.reviews.used}
            limit={usage.reviews.limit}
          />
        </View>
        {!isPro && (
          <Pressable
            testID="profile-upgrade"
            accessibilityRole="button"
            onPress={() => router.push('/paywall')}
            className="btn-primary"
          >
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
              testID="profile-reminders"
              accessibilityLabel="Review reminders"
              value={remindersOn}
              onValueChange={onRemindersChange}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
          <SettingsRow
            testID="profile-reminder-time"
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
          <SettingsRow testID="profile-manage-subscription" label="Manage subscription" isFirst />
          <SettingsRow testID="profile-restore-purchases" label="Restore purchases" />
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
            testID="profile-sign-out"
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
    </>
  );
}

/** Profile & settings (design "Profile & settings — Free (scrolled)"). */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [now, setNow] = useState(() => Date.now());

  const { getToken } = useAuth();

  // @clerk/expo's useAuth returns a new getToken on every render. Keep the latest one in a ref so
  // the focus callback below stays stable; with getToken in its deps it re-ran on every render.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());

      // Skip state updates when the component unmounts before the request finishes.
      let cancelled = false;
      getEntitlement(() => getTokenRef.current())
        .then((entitlement) => {
          if (!cancelled) setState({ status: 'success', entitlement });
        })
        .catch((error) => {
          if (!cancelled) setState({ status: 'error', error });
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <>
      <Stack.Title>Profile</Stack.Title>
      <ScrollView
        testID="screen-profile"
        className="app-shell"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="w-full max-w-[600px] self-center gap-[18px] px-margin pt-lg"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {state.status === 'loading' ? (
          <View className="gap-md" accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading settings" />
            <Text className="text-muted text-center body-md">Loading your settings…</Text>
          </View>
        ) : state.status === 'error' ? (
          <View accessibilityLiveRegion="polite">
            <Text className="text-muted text-center body-md">Failed to load settings</Text>
          </View>
        ) : (
          <ProfileContent entitlement={state.entitlement} now={now} />
        )}
      </ScrollView>
    </>
  );
}
