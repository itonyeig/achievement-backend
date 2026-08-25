import { Types } from 'mongoose';
import type { UserDocument } from '../../user/schema/user.schema';
import { BadgeService } from '../badge.service';
import { AchievementUnlockedListener } from './achievement-unlocked.listener';

describe('AchievementUnlockedListener', () => {
  const user = {
    _id: new Types.ObjectId('66c740862c2cb219f9b9ef11'),
    name: 'Jane Doe',
  } as unknown as UserDocument;
  const badgeService = {
    evaluateBadges: jest.fn<(user: UserDocument) => Promise<void>>(),
  };
  const listener = new AchievementUnlockedListener(
    badgeService as unknown as BadgeService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    badgeService.evaluateBadges.mockResolvedValue();
  });

  it('evaluates badges for the user in the achievement event', async () => {
    await listener.handle({ achievement_name: '35 Purchases', user });

    expect(badgeService.evaluateBadges).toHaveBeenCalledTimes(1);
    expect(badgeService.evaluateBadges).toHaveBeenCalledWith(user);
  });

  it('propagates badge evaluation failures', async () => {
    const error = new Error('Failed to evaluate badges');
    badgeService.evaluateBadges.mockRejectedValue(error);

    await expect(
      listener.handle({ achievement_name: '35 Purchases', user }),
    ).rejects.toBe(error);
  });
});
