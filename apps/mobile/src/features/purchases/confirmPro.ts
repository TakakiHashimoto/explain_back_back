import { refreshEntitlement } from '@/features/usage/api/api.usage';
import { GetToken } from '@/lib/api-fetch';

/**
 * Asks the backend to re-read RevenueCat right after a purchase or restore.
 * The backend decides Pro (spec §32), so the SDK result alone never shows Pro.
 * Resolves false instead of throwing when the backend does not show Pro yet;
 * the RevenueCat webhook catches up later.
 */
export async function confirmPro(getToken: GetToken): Promise<boolean> {
  try {
    return (await refreshEntitlement(getToken)).isPro;
  } catch (e) {
    console.warn('entitlement refresh failed', e);
    return false;
  }
}
