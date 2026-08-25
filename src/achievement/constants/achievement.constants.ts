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
  // assessment defines only the First Purchase and 5 Purchases achievements but references a badge requiring
  // eight achievements, purchase milestones are assumed to continue in increments of five through 35 purchases.
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

export const ACHIEVEMENT_NAMES = Object.freeze(
  PURCHASE_ACHIEVEMENTS.map(({ name }) => name),
);

export type AchievementName = (typeof ACHIEVEMENT_NAMES)[number];
