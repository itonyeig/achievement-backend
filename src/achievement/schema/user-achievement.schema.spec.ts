import { UserAchievementSchema } from './user-achievement.schema';

describe('UserAchievementSchema', () => {
  it('requires the user, achievement name, and unlock date', () => {
    expect(UserAchievementSchema.path('userId').options.required).toBe(true);
    expect(UserAchievementSchema.path('achievementName').options.required).toBe(
      true,
    );
    expect(UserAchievementSchema.path('unlockedAt').options.required).toBe(
      true,
    );
    expect(UserAchievementSchema.path('unlockedAt').options.default).toBe(
      Date.now,
    );
  });

  it('prevents a user from unlocking the same achievement twice', () => {
    expect(UserAchievementSchema.indexes()).toContainEqual([
      { userId: 1, achievementName: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });
});
