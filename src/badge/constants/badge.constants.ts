export type BadgeDefinition = {
  readonly name: string;
  readonly requiredAchievementCount: number;
};

export const BADGES = [
  {
    name: 'Advanced',
    requiredAchievementCount: 8,
  },
] as const satisfies readonly BadgeDefinition[];

export const BADGE_NAMES = Object.freeze(BADGES.map(({ name }) => name));

export type BadgeName = (typeof BADGE_NAMES)[number];
