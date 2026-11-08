import { apiFetch, GetToken } from '@/lib/api-fetch';
import { Entitlement } from '../types';

export function getEntitlement(getToken: GetToken): Promise<Entitlement> {
  return apiFetch<Entitlement>('/api/v1/me/entitlement', getToken);
}

/** Makes the backend re-read RevenueCat now (after a purchase / restore) and returns the result. */
export function refreshEntitlement(getToken: GetToken): Promise<Entitlement> {
  return apiFetch<Entitlement>('/api/v1/me/entitlement/refresh', getToken, { method: 'POST' });
}
