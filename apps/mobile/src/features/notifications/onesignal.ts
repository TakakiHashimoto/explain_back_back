import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Alert, Platform } from 'react-native';
import type { PushSubscriptionChangedState } from 'react-native-onesignal';

const APP_ID = '4ef89c9c-db70-4019-9b48-5cbd71f70e87';

let sdk: typeof import('react-native-onesignal') | undefined;
let dialogShown = false;

function reportError(error: unknown) {
  console.warn('OneSignal push registration:', error);
}

/** Owns all native OneSignal calls; web and Expo Go do not load the native SDK. */
export const notifications = {
  initialize(): () => void {
    if (
      (Platform.OS !== 'ios' && Platform.OS !== 'android') ||
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ) {
      return () => {};
    }

    if (!sdk) {
      const nativeSdk: typeof import('react-native-onesignal') = require('react-native-onesignal');
      nativeSdk.OneSignal.Debug.setLogLevel(
        __DEV__ ? nativeSdk.LogLevel.Verbose : nativeSdk.LogLevel.None,
      );
      nativeSdk.OneSignal.initialize(APP_ID);
      sdk = nativeSdk;
    }

    const { OneSignal } = sdk;
    let active = true;
    const showVerification = (id: string | null | undefined) => {
      if (!active || dialogShown || !id?.trim() || id.startsWith('local-')) return;

      dialogShown = true;
      Alert.alert(
        'Your OneSignal SDK integration is complete!',
        'You can now send Push Notifications & In-App Messages through OneSignal. Tap below to enable push notifications.',
        [{
          text: 'Got it',
          onPress: () => {
            void OneSignal.Notifications.requestPermission(true).catch(reportError);
          },
        }],
        { cancelable: false },
      );
    };
    const onSubscriptionChange = (event: PushSubscriptionChangedState) => {
      showVerification(event.current.id);
    };

    OneSignal.User.pushSubscription.addEventListener('change', onSubscriptionChange);
    void OneSignal.User.pushSubscription.getIdAsync().then(showVerification).catch(reportError);

    // React retains this cleanup and its listener until the root layout unmounts.
    return () => {
      active = false;
      OneSignal.User.pushSubscription.removeEventListener('change', onSubscriptionChange);
    };
  },

  login(externalId: string) {
    sdk?.OneSignal.login(externalId);
  },

  logout() {
    sdk?.OneSignal.logout();
  },

  addEmail(email: string) {
    sdk?.OneSignal.User.addEmail(email);
  },

  removeEmail(email: string) {
    sdk?.OneSignal.User.removeEmail(email);
  },

  addSms(phoneNumber: string) {
    sdk?.OneSignal.User.addSms(phoneNumber);
  },

  removeSms(phoneNumber: string) {
    sdk?.OneSignal.User.removeSms(phoneNumber);
  },

  addTags(tags: Record<string, string>) {
    sdk?.OneSignal.User.addTags(tags);
  },

  removeTags(keys: string[]) {
    sdk?.OneSignal.User.removeTags(keys);
  },
};
