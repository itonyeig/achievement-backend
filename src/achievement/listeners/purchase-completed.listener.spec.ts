import { Types } from 'mongoose';
import { AchievementService } from '../achievement.service';
import { PurchaseCompletedListener } from './purchase-completed.listener';

describe('PurchaseCompletedListener', () => {
  const achievementService = {
    evaluatePurchaseAchievements:
      jest.fn<(userId: string | Types.ObjectId) => Promise<void>>(),
  };
  const listener = new PurchaseCompletedListener(
    achievementService as unknown as AchievementService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    achievementService.evaluatePurchaseAchievements.mockResolvedValue();
  });

  it.each([
    '66c740862c2cb219f9b9ef11',
    new Types.ObjectId('66c740862c2cb219f9b9ef11'),
  ])(
    'evaluates achievements for the completed purchase user',
    async (userId) => {
      await listener.handle({ userId });

      expect(
        achievementService.evaluatePurchaseAchievements,
      ).toHaveBeenCalledTimes(1);
      expect(
        achievementService.evaluatePurchaseAchievements,
      ).toHaveBeenCalledWith(userId);
    },
  );

  it('propagates achievement evaluation failures', async () => {
    const error = new Error('Failed to evaluate achievements');
    achievementService.evaluatePurchaseAchievements.mockRejectedValue(error);

    await expect(
      listener.handle({ userId: '66c740862c2cb219f9b9ef11' }),
    ).rejects.toBe(error);
  });
});
