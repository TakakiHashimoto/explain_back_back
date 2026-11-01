import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';

const PRO_ENTITLEMENT = 'pro';
let currentUserId: string | undefined;

export const purchases = {
  /**
   * First call configures the SDK;
   * later calls with another id switch users via logIn.
   */
  async identify(appUserId: string): Promise<void> {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);

    let apiKey = '';
    if (Platform.OS === 'ios') {
      apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ?? '';
      if (!apiKey) {
        console.warn('Missing EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY');
      }
    } else if (Platform.OS === 'android') {
      apiKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY ?? '';
      if (!apiKey) {
        console.warn('Missing EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY');
      }
    } else {
      console.warn('Unexpected platform.');
    }

    // HACK
    apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

    if (currentUserId === undefined) {
      console.log('purchases.identify: first time');
      Purchases.configure({ apiKey, appUserID: appUserId });
    } else if (currentUserId !== appUserId) {
      console.log('purchases.identify: logIn');
      await Purchases.logIn(appUserId);
    }
    currentUserId = appUserId;
  },

  /**
   * Monthly/annual packages of the current offering,
   * or null when unavailable.
   */
  getPlans(): Promise<{
    monthly: PurchasesPackage;
    annual: PurchasesPackage;
  } | null> {
    return Purchases.getOfferings().then((offering) => {
      const monthly = offering.current?.monthly;
      const annual = offering.current?.annual;
      if (!monthly || !annual) {
        return null;
      }
      return { monthly, annual };
    });
  },

  /**
   * Buys a package; cancellation is a normal result,
   * not an error.
   */
  purchase(pkg: PurchasesPackage) {},
};
