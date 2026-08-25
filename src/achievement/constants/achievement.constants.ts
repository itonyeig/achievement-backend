export type PurchaseAchievementDefinition = {
  readonly name: string;
  readonly threshold: number;
};

export const PURCHASE_ACHIEVEMENTS = [
  {
    name: 'First Purchase',
    threshold: 1,
  },
  {
    name: '5 Purchases',
    threshold: 5,
  },
  {
    name: '10 Purchases',
    threshold: 10,
  },
  {
    name: '15 Purchases',
    threshold: 15,
  },
  {
    name: '20 Purchases',
    threshold: 20,
  },
  {
    name: '25 Purchases',
    threshold: 25,
  },
  {
    name: '30 Purchases',
    threshold: 30,
  },
  {
    name: '35 Purchases',
    threshold: 35,
  },
] as const satisfies readonly PurchaseAchievementDefinition[];
