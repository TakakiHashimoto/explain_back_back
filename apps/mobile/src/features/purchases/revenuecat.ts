import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import type { PurchasesError, PurchasesPackage } from 'react-native-purchases';

const PRO_ENTITLEMENT = 'pro';
let currentUserId: string | undefined;

export const purchases = {
  /**
   * First call configures the SDK;
   * later calls with another id switch users via logIn.
   * Sign-out intentionally does nothing here: logOut() would create an anonymous ID,
   * and the next sign-in switches users via logIn.
   */
  async identify(appUserId: string): Promise<void> {
    if (__DEV__) Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);

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
      Purchases.configure({ apiKey, appUserID: appUserId });
    } else if (currentUserId !== appUserId) {
      await Purchases.logIn(appUserId);
    }
    currentUserId = appUserId;
  },

  /**
   * Monthly/annual packages of the current offering,
   * or null when unavailable.
   */
  async getPlans(): Promise<{
    monthly: PurchasesPackage;
    annual: PurchasesPackage;
  } | null> {
    // Paywall can open before identify (e.g. /me is slow or failed); treat it as "unavailable".
    if (!(await Purchases.isConfigured())) return null;

    const offerings = await Purchases.getOfferings();
    if (!offerings) {
      return null;
    }
    const monthly = offerings.current?.monthly;
    const annual = offerings.current?.annual;
    if (!monthly || !annual) {
      return null;
    }
    return { monthly, annual };
  },

  /**
   * Buys a package; cancellation is a normal result, not an error.
   */
  async purchase(
    pkg: PurchasesPackage,
  ): Promise<'purchased' | 'cancelled' | 'pending' | 'unverified'> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (!customerInfo.entitlements.active[PRO_ENTITLEMENT]) {
        console.warn(`Purchase completed but "${PRO_ENTITLEMENT}" is not active`);
        return 'unverified';
      }
      return 'purchased';
    } catch (e) {
      const code = (e as PurchasesError).code;
      if (code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return 'cancelled';
      }
      if (code === Purchases.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        return 'pending';
      }
      throw e;
    }
  },

  /**
   * Restores the store account's purchases to the current user;
   * finding nothing is a normal result, not an error.
   */
  async restore(): Promise<'restored' | 'nothing'> {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] ? 'restored' : 'nothing';
  },
};
