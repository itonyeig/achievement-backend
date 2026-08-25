import { BADGES, BADGE_NAMES } from './badge.constants';

describe('BADGES', () => {
  it('defines the Advanced badge at eight achievements', () => {
    expect(BADGES).toEqual([{ name: 'Advanced', requiredAchievementCount: 8 }]);
  });

  it('exposes the configured names as a readonly array', () => {
    expect(BADGE_NAMES).toEqual(BADGES.map(({ name }) => name));
    expect(Object.isFrozen(BADGE_NAMES)).toBe(true);
  });
});
