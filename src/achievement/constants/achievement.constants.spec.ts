import {
  ACHIEVEMENT_NAMES,
  PURCHASE_ACHIEVEMENTS,
} from './achievement.constants';

describe('PURCHASE_ACHIEVEMENTS', () => {
  it('defines the agreed purchase milestones in ascending order', () => {
    expect(PURCHASE_ACHIEVEMENTS).toEqual([
      { name: 'First Purchase', threshold: 1 },
      { name: '5 Purchases', threshold: 5 },
      { name: '10 Purchases', threshold: 10 },
      { name: '15 Purchases', threshold: 15 },
      { name: '20 Purchases', threshold: 20 },
      { name: '25 Purchases', threshold: 25 },
      { name: '30 Purchases', threshold: 30 },
      { name: '35 Purchases', threshold: 35 },
    ]);
  });

  it('contains unique names and thresholds', () => {
    const names = PURCHASE_ACHIEVEMENTS.map(({ name }) => name);
    const thresholds = PURCHASE_ACHIEVEMENTS.map(({ threshold }) => threshold);

    expect(new Set(names).size).toBe(PURCHASE_ACHIEVEMENTS.length);
    expect(new Set(thresholds).size).toBe(PURCHASE_ACHIEVEMENTS.length);
  });

  it('exposes the configured names as a readonly array', () => {
    expect(ACHIEVEMENT_NAMES).toEqual(
      PURCHASE_ACHIEVEMENTS.map(({ name }) => name),
    );
    expect(Object.isFrozen(ACHIEVEMENT_NAMES)).toBe(true);
  });
});
