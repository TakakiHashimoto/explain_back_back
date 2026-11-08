import { refreshEntitlement } from '@/features/usage/api/api.usage';
import { Entitlement } from '@/features/usage/types';
import { GetToken } from '@/lib/api-fetch';
import { purchases } from './revenuecat';

/**
 * Asks the backend to re-read RevenueCat right after a purchase or restore.
 * The backend decides Pro (spec §32), so the SDK result alone never shows Pro.
 * Resolves to the backend's entitlement, or null instead of throwing when the backend could not
 * be reached; the RevenueCat webhook catches up later.
 */
export async function confirmPro(getToken: GetToken): Promise<Entitlement | null> {
  try {
    return await refreshEntitlement(getToken);
  } catch (e) {
    console.warn('entitlement refresh failed', e);
    return null;
  }
}

/**
 * What a restore led to, for the screen to choose its message:
 * - `pro`: the backend shows Pro.
 * - `pending`: the store restored Pro, but the backend does not show it yet. `entitlement` is the
 *   backend's current state, or null when it could not be reached.
 * - `nothing`: this store account has no Pro purchase.
 */
export type RestoreOutcome =
  | { kind: 'pro'; entitlement: Entitlement }
  | { kind: 'pending'; entitlement: Entitlement | null }
  | { kind: 'nothing' };

/**
 * Restores the store account's purchases, then asks the backend to confirm Pro.
 * Shared by the Paywall and Profile so both screens handle a restore the same way.
 * @throws when the restore itself fails (e.g. the SDK is not configured or the store is offline).
 */
export async function restoreAndConfirm(getToken: GetToken): Promise<RestoreOutcome> {
  if ((await purchases.restore()) === 'nothing') return { kind: 'nothing' };

  const entitlement = await confirmPro(getToken);
  return entitlement?.isPro ? { kind: 'pro', entitlement } : { kind: 'pending', entitlement };
}
