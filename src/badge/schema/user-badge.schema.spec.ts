import { BADGE_NAMES } from '../constants/badge.constants';
import { UserBadgeSchema } from './user-badge.schema';

describe('UserBadgeSchema', () => {
  it('restricts persisted badges to configured badge names', () => {
    expect(UserBadgeSchema.path('badgeName').options.required).toBe(true);
    expect(UserBadgeSchema.path('badgeName').options.enum).toEqual(BADGE_NAMES);
  });

  it('prevents a user from unlocking the same badge twice', () => {
    expect(UserBadgeSchema.indexes()).toContainEqual([
      { userId: 1, badgeName: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });
});
