import { apiFetch, GetToken } from '@/lib/api-fetch';
import { Entitlement } from '../types';

export function getEntitlement(getToken: GetToken): Promise<Entitlement> {
  return apiFetch<Entitlement>('/api/v1/me/entitlement', getToken);
}
