import { Entitlement } from '../types';

export const dummyEntitlement: Entitlement = {
  // isPro: false,
  // usage: { analyses: { used: 2, limit: 3 }, reviews: { used: 2, limit: 18 } },

  isPro: true,
  usage: { analyses: { used: 20, limit: 20 }, reviews: { used: 100, limit: 120 } },
};
