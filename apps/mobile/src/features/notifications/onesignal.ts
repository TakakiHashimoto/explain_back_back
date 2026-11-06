import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// TODO: Hide this app id
const APP_ID = '4ef89c9c-db70-4019-9b48-5cbd71f70e87';

let sdk: typeof import('react-native-onesignal') | undefined;

/** Owns all native OneSignal calls; web and Expo Go do not load the native SDK. */
export const notifications = {
  /** Loads the SDK once. It does not ask for permission; see `enable`. */
  initialize() {
    if (
      sdk ||
      (Platform.OS !== 'ios' && Platform.OS !== 'android') ||
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ) {
      return;
    }

    const nativeSdk: typeof import('react-native-onesignal') = require('react-native-onesignal');
    nativeSdk.OneSignal.Debug.setLogLevel(
      __DEV__ ? nativeSdk.LogLevel.Verbose : nativeSdk.LogLevel.None,
    );
    nativeSdk.OneSignal.initialize(APP_ID);
    sdk = nativeSdk;
  },

  /** The installed native SDK delivers launch and running-app clicks here. */
  onClick(listener: (event: import('react-native-onesignal').NotificationClickEvent) => void) {
    notifications.initialize();
    const native = sdk;
    native?.OneSignal.Notifications.addEventListener('click', listener);
    return () => native?.OneSignal.Notifications.removeEventListener('click', listener);
  },

  /** True when this device receives pushes: OS permission granted and not opted out. */
  async isOptedIn(): Promise<boolean> {
    return (await sdk?.OneSignal.User.pushSubscription.getOptedInAsync()) ?? false;
  },

  /**
   * Turns pushes on for this device, asking for the OS permission first. When it was denied
   * before, OneSignal offers to open the app settings instead. Resolves to whether it is on.
   */
  async enable(): Promise<boolean> {
    if (!sdk) return false;
    const granted = await sdk.OneSignal.Notifications.requestPermission(true);
    if (granted) sdk.OneSignal.User.pushSubscription.optIn();
    return granted;
  },

  /** Stops pushes on this device. The OS permission stays, so `enable` can resume them. */
  disable() {
    sdk?.OneSignal.User.pushSubscription.optOut();
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
