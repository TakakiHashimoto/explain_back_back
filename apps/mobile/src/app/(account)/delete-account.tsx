import { router, Stack, useFocusEffect } from 'expo-router';
import { Alert, BackHandler, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icon';
import { colors } from '@/styles/tokens';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getEntitlement } from '@/features/usage/api/api.usage';
import { useAuth, useClerk } from '@clerk/expo';
import { purchases } from '@/features/purchases/revenuecat';
import { notifications } from '@/features/notifications/onesignal';
import { Entitlement } from '@/features/usage/types';

/** What account deletion removes (spec §16). Copy only; the backend deletes everything. */
const DELETED_ITEMS = [
  { icon: 'mic', label: 'Explanations and their analyses' },
  { icon: 'review', label: 'Review questions, answers and schedule' },
  { icon: 'progress', label: 'Usage history and reminders' },
  { icon: 'profile', label: 'Your sign-in account' },
] as const;

/** Since this app is Android-only, users can unsubscribe through this URL even without RevenueCat. */
const PLAY_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

/**
 * Delete account (spec §16, design A): Pro warning → what gets deleted →
 * "Keep my account" (primary) → "Delete account" (danger, last).
 */
export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useClerk();

  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [managementUrl, setManagementUrl] = useState<string>(PLAY_SUBSCRIPTIONS_URL);
  // Unknown (loading or failed) counts as Pro, so the billing warning is shown rather than missed.
  const isPro = entitlement?.isPro ?? true;

  const isDeletingRef = useRef(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { getToken } = useAuth();

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });
  useFocusEffect(
    useCallback(() => {
      getEntitlement(() => getTokenRef.current())
        .then((entitlement) => {
          setEntitlement(entitlement);
          if (!entitlement.isPro) return;
          purchases
            .getManagementUrl()
            .then((url) => {
              if (url) setManagementUrl(url);
            })
            .catch(() => {});
        })
        .catch(() => {});
    }, []),
  );

  useEffect(() => {
    if (!isDeleting) return;
    // Disable hardware back button
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [isDeleting]);

  function startDeletion() {
    isDeletingRef.current = true;
    setIsDeleting(true);
  }

  function endDeletion() {
    isDeletingRef.current = false;
    setIsDeleting(false);
  }

  function onKeep() {
    router.back();
  }

  function onDelete() {
    Alert.alert('Delete account?', 'This permanently deletes all your data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (isDeletingRef.current) return;
          startDeletion();
          try {
            const token = await getToken();
            const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/me`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (res.status !== 204) {
              Alert.alert("Couldn't delete your account", 'Please try again.');
              endDeletion();
              return;
            }
            notifications.logout();
            await signOut().catch(() => {});
          } catch {
            Alert.alert("Couldn't reach the server", 'Check your connection and try again.');
            endDeletion();
          }
        },
      },
    ]);
  }

  /** Opens the store's subscription page. */
  async function openManagementUrl(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Couldn't open your subscription", 'Please try again.');
    }
  }

  return (
    <>
      <Stack.Title>Delete account</Stack.Title>
      <Stack.Screen options={{ headerBackVisible: !isDeleting }} />
      <View testID="screen-delete-account" className="app-shell">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="w-full max-w-[600px] self-center gap-[28px] px-lg pt-lg pb-lg"
        >
          {/* Heading */}
          <View className="gap-[10px]">
            <Text accessibilityRole="header" className="headline-lg">
              Delete your account?
            </Text>
            <Text className="text-secondary body-lg">
              Your account and everything in it will be permanently deleted. You can’t undo this.
            </Text>
          </View>

          {/* Billing continues after deletion (spec §16.3) */}
          {isPro && (
            <View
              testID="delete-account-pro-warning"
              className="gap-md bg-warning-soft p-[20px] border border-warning-border rounded-lg"
            >
              <View className="flex-row items-start gap-[10px]">
                <Icon name="error" size={20} color={colors.warningText} />
                <View className="flex-1 gap-xs">
                  <Text className="font-semibold text-warning-text body-md">
                    Your Pro subscription keeps billing
                  </Text>
                  <Text className="text-warning-text body-sm">
                    Deleting your account doesn’t cancel it. Cancel in Google Play first.
                  </Text>
                </View>
              </View>
              <Pressable
                testID="delete-account-manage-subscription"
                accessibilityRole="link"
                onPress={() => openManagementUrl(managementUrl)}
                disabled={isDeleting}
                accessibilityState={{ disabled: isDeleting }}
                className="flex-row justify-center items-center gap-[6px] bg-surface active:bg-surface-muted border border-warning-border rounded-full min-h-[44px]"
              >
                <Text className="font-sans font-semibold text-[14px] text-warning-text leading-[20px]">
                  Manage subscription
                </Text>
                <Icon name="arrow" size={16} color={colors.warningText} />
              </Pressable>
            </View>
          )}

          {/* What gets deleted */}
          <View className="gap-[12px]">
            <Text className="pl-xs text-muted uppercase tracking-[0.9px] label-sm">
              What gets deleted
            </Text>
            <View className="list">
              {DELETED_ITEMS.map(({ icon, label }, index) => (
                <View
                  key={label}
                  className={`flex-row items-center gap-[14px] p-[18px] ${
                    index === 0 ? '' : 'list-row-divider'
                  }`}
                >
                  <Icon name={icon} size={20} color={colors.dangerText} />
                  <Text className="flex-1 body-lg">{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Actions: the safe choice first and most prominent, the destructive one last. */}
        <View
          className="self-center gap-[12px] bg-background px-lg pt-[20px] w-full max-w-[600px]"
          style={{ paddingBottom: insets.bottom + 32 }}
        >
          <Pressable
            testID="delete-account-keep"
            accessibilityRole="button"
            onPress={onKeep}
            disabled={isDeleting}
            accessibilityState={{ disabled: isDeleting }}
            className="btn-primary"
          >
            <Text className="btn-primary-text">Keep my account</Text>
          </Pressable>
          <Pressable
            testID="delete-account-confirm"
            accessibilityRole="button"
            onPress={onDelete}
            disabled={isDeleting}
            accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
            className={`btn-danger ${isDeleting ? 'opacity-50' : ''}`}
          >
            <Text className="btn-danger-text">{isDeleting ? 'Deleting…' : 'Delete account'}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}
