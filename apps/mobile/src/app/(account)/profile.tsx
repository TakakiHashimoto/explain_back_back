import { useAuth, useClerk, useUser } from '@clerk/expo';
import Constants from 'expo-constants';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { purchases } from '@/features/purchases/revenuecat';
import { confirmPro } from '@/features/purchases/confirmPro';
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

type User = ReturnType<typeof useUser>['user'];
type IdentityProps = {
  user: User;
  /** Undefined while the plan is unknown (loading or offline); the badge is hidden then. */
  isPro?: boolean;
};

/** Avatar initial, name, email and the Pro / Free badge. Works without the backend. */
function Identity({ user, isPro }: IdentityProps) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const email = user?.primaryEmailAddress?.emailAddress;
  const initial = (fullName || email || '?').charAt(0).toUpperCase();

  return (
    <View className="flex-row items-center gap-[14px]">
      <View className="justify-center items-center bg-primary-soft rounded-full w-14 h-14">
        <Text className="font-sans font-bold text-[22px] text-primary-lip">{initial}</Text>
      </View>
      <View className="flex-1 gap-[2px] min-w-0">
        {fullName ? <Text className="headline-sm">{fullName}</Text> : null}
        {email ? <Text className="text-muted body-sm">{email}</Text> : null}
      </View>
      {isPro === undefined ? null : isPro ? (
        /* Pro badge */
        <View
          testID="profile-plan-badge"
          className="bg-primary px-[10px] py-[3px] border border-primary rounded-full"
        >
          <Text className="font-sans font-bold text-[12px] text-on-primary leading-[16px]">
            Pro
          </Text>
        </View>
      ) : (
        /* Free badge */
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
  );
}

type ProfileUsageCardProps = {
  isPro: boolean;
  usage: Entitlement['usage'];
  /** Time of the last entitlement load; the reset countdown is computed from it. */
  now: number;
};

/** This week's usage meters, reset countdown and, on Free, the upgrade button. */
function ProfileUsageCard({ isPro, usage, now }: ProfileUsageCardProps) {
  const resetLabel = usage.windowEnd
    ? formatResetIn(Math.ceil((new Date(usage.windowEnd).getTime() - now) / (60 * 1000)))
    : null;

  return (
    <>
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
    </>
  );
}

/** Review reminders switch (push opt-in on this device); MVP timing is shared. */
function ReminderSection() {
  // Mirrors this device's push opt-in; turning it on is where we ask for notification permission.
  const [remindersOn, setRemindersOn] = useState(false);

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

  return (
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
      </View>
      <Text className="text-muted body-sm">Daily around 20:17 Japan time (JST).</Text>
    </View>
  );
}

type SubscriptionSectionProps = {
  /** Undefined while the plan is unknown; Manage shows only for Pro. */
  isPro?: boolean;
  onManage: () => void;
  onRestore: () => void;
};

/** Manage (Pro only) and restore the subscription through RevenueCat. */
function SubscriptionSection({ isPro, onManage, onRestore }: SubscriptionSectionProps) {
  return (
    <View className="gap-sm">
      <SectionLabel>Subscription</SectionLabel>
      <View className="overflow-hidden list">
        {isPro && (
          <SettingsRow
            testID="profile-manage-subscription"
            label="Manage subscription"
            onPress={onManage}
            isFirst
          />
        )}
        <SettingsRow
          testID="profile-restore-purchases"
          label="Restore purchases"
          onPress={onRestore}
          isFirst={!isPro}
        />
      </View>
    </View>
  );
}

/** Opens the store's subscription page; there is none when Pro was not bought on this account. */
async function manageSubscription() {
  try {
    const url = await purchases.getManagementUrl();
    if (url) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        'No subscription found',
        'There is no active subscription on this store account.',
      );
    }
  } catch {
    Alert.alert("Couldn't open your subscription", 'Please try again.');
  }
}

type AccountSectionProps = {
  onSignOut: () => void;
};

/** Account links and Sign out, which only needs Clerk, so it stays usable offline. */
function AccountSection({ onSignOut }: AccountSectionProps) {
  return (
    <View className="gap-sm">
      <SectionLabel>Account</SectionLabel>
      <View className="overflow-hidden list">
        {/* TODO: destination screens. */}
        <SettingsRow label="Privacy & recordings" isFirst />
        <SettingsRow label="Help & feedback" />
        <Pressable
          testID="profile-sign-out"
          accessibilityRole="button"
          onPress={onSignOut}
          className="active:bg-background min-h-[52px] list-row list-row-divider"
        >
          <Text className="font-semibold text-danger-text body-md">Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Profile & settings (design "Profile & settings — Free (scrolled)"). */
export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();

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

  // Each load gets a number and only the latest may update the state, so a slow earlier request
  // (focus vs. Try again) cannot overwrite a newer result. Bumping it on blur drops late responses.
  const requestIdRef = useRef(0);

  /** Fetches the entitlement and refreshes `now` for the reset countdown. */
  const loadEntitlement = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setNow(Date.now());
    getEntitlement(() => getTokenRef.current())
      .then((entitlement) => {
        if (requestId === requestIdRef.current) setState({ status: 'success', entitlement });
      })
      .catch((error) => {
        if (requestId === requestIdRef.current) setState({ status: 'error', error });
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());

      loadEntitlement();
      return () => {
        requestIdRef.current++;
      };
    }, [loadEntitlement]),
  );

  const isRestoringRef = useRef(false);

  /** Restores purchases, asks the backend to re-read RevenueCat, then reloads the plan. */
  const restorePurchases = async () => {
    if (isRestoringRef.current) return;
    isRestoringRef.current = true;
    try {
      const result = await purchases.restore();
      if (result === 'nothing') {
        Alert.alert('Nothing to restore', 'No Pro purchase was found for this store account.');
      } else if (await confirmPro(() => getTokenRef.current())) {
        Alert.alert('Purchases restored', "You're Pro again.");
      } else {
        Alert.alert('Purchases restored', 'Pro may take a moment to appear.');
      }
    } catch {
      Alert.alert('Restore failed', 'Please try again.');
    } finally {
      isRestoringRef.current = false;
      loadEntitlement();
    }
  };

  /** Try again from the error state; a focus refresh keeps the old usage on screen instead. */
  const retry = () => {
    setState({ status: 'loading' });
    loadEntitlement();
  };

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
        {/* Identity */}
        <Identity
          user={user}
          isPro={state.status === 'success' ? state.entitlement.isPro : undefined}
        />

        {/* This week's usage */}
        <View className="gap-[14px] card">
          {state.status === 'loading' ? (
            <View className="gap-md" accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.primary} accessibilityLabel="Loading settings" />
              <Text className="text-muted text-center body-md">Loading your settings…</Text>
            </View>
          ) : state.status === 'error' ? (
            <View className="gap-sm" accessibilityLiveRegion="polite">
              <Text className="text-muted text-center body-md">Couldn&apos;t load usage</Text>
              <Pressable
                testID="profile-usage-retry"
                accessibilityRole="button"
                onPress={retry}
                className="btn-secondary"
              >
                <Text className="btn-secondary-text">Try again</Text>
              </Pressable>
            </View>
          ) : (
            <ProfileUsageCard
              isPro={state.entitlement.isPro}
              usage={state.entitlement.usage}
              now={now}
            />
          )}
        </View>

        {/* Reminders */}
        <ReminderSection />

        {/* Subscription */}
        <SubscriptionSection
          isPro={state.status === 'success' ? state.entitlement.isPro : undefined}
          onManage={manageSubscription}
          onRestore={restorePurchases}
        />

        {/* Account */}
        <AccountSection onSignOut={signOut} />

        {/* `expoConfig.version` comes from app.config.ts, which copies package.json's version. */}
        <Text className="text-[12px] text-muted text-center body-sm">
          Explain It Back · v{Constants.expoConfig?.version}
        </Text>
      </ScrollView>
    </>
  );
}
