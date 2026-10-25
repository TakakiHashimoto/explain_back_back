export type Entitlement = {
  isPro: boolean;
  usage: {
    analyses: {
      used: number;
      limit: number;
    };
    reviews: {
      used: number;
      limit: number;
    };
    windowEnd?: string;
  };
};
