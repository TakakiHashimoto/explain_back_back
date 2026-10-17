import { apiFetch, GetToken } from '@/lib/api-fetch';
import { Usage } from '../types';

export function getEntitlement(getToken: GetToken): Promise<Usage> {
  return apiFetch<Usage>('/api/v1/me/entitlement', getToken);
}
