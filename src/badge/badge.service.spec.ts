import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AchievementService } from '../achievement/achievement.service';
import { EventName } from '../common/enums/event-name.enum';
import type { UserDocument } from '../user/schema/user.schema';
import { BadgeService } from './badge.service';
import type { BadgeName } from './constants/badge.constants';
import type { BadgeUnlockedEvent } from './events/badge-unlocked.event';
import { UserBadge } from './schema/user-badge.schema';

describe('BadgeService', () => {
  let service: BadgeService;
  let emittedEvents: BadgeUnlockedEvent[];
  const userId = new Types.ObjectId('66c740862c2cb219f9b9ef11');
  const user = {
    _id: userId,
    name: 'Jane Doe',
    email: 'jane@example.com',
    accountNumber: '0000000000',
    accountName: 'Jane Doe',
    bankCode: '057',
    recipientCode: 'RCP_example',
  } as unknown as UserDocument;
  const achievementService = {
    countUnlockedByUserId:
      jest.fn<(userId: string | Types.ObjectId) => Promise<number>>(),
  };
  const userBadgeModel = {
    updateOne: jest.fn<
      (
        filter: { userId: Types.ObjectId; badgeName: BadgeName },
        update: {
          $setOnInsert: {
            userId: Types.ObjectId;
            badgeName: BadgeName;
            unlockedAt: Date;
          };
        },
        options: { upsert: boolean },
      ) => Promise<{ upsertedCount: number }>
    >(),
  };
  const eventEmitter = {
    emit: jest.fn<(eventName: string, event: BadgeUnlockedEvent) => boolean>(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgeService,
        {
          provide: getModelToken(UserBadge.name),
          useValue: userBadgeModel,
        },
        {
          provide: AchievementService,
          useValue: achievementService,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get<BadgeService>(BadgeService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    emittedEvents = [];
    achievementService.countUnlockedByUserId.mockResolvedValue(8);
    userBadgeModel.updateOne.mockResolvedValue({ upsertedCount: 0 });
    eventEmitter.emit.mockImplementation(
      (_eventName: string, event: BadgeUnlockedEvent) => {
        emittedEvents.push(event);
        return true;
      },
    );
  });

  it('upserts Advanced when the user has exactly eight achievements', async () => {
    await service.evaluateBadges(user);

    expect(achievementService.countUnlockedByUserId).toHaveBeenCalledTimes(1);
    expect(achievementService.countUnlockedByUserId).toHaveBeenCalledWith(
      userId,
    );
    expect(userBadgeModel.updateOne).toHaveBeenCalledTimes(1);
    expect(userBadgeModel.updateOne).toHaveBeenCalledWith(
      { userId, badgeName: 'Advanced' },
      {
        $setOnInsert: {
          userId,
          badgeName: 'Advanced',
          unlockedAt: expect.any(Date) as Date,
        },
      },
      { upsert: true },
    );
  });

  it.each([0, 1, 5, 7, 9])(
    'does nothing when the achievement count is %i',
    async (achievementCount) => {
      achievementService.countUnlockedByUserId.mockResolvedValue(
        achievementCount,
      );

      await service.evaluateBadges(user);

      expect(userBadgeModel.updateOne).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    },
  );

  it('emits the exact badge payload after a new badge is persisted', async () => {
    userBadgeModel.updateOne.mockResolvedValue({ upsertedCount: 1 });

    await service.evaluateBadges(user);

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(EventName.BadgeUnlocked, {
      badge_name: 'Advanced',
      user,
    });

    const [event] = emittedEvents;

    if (!event) {
      throw new Error('BadgeUnlocked event was not emitted');
    }

    expect(Object.keys(event)).toEqual(['badge_name', 'user']);
    expect(event.user).toBe(user);
    expect(userBadgeModel.updateOne.mock.invocationCallOrder[0]).toBeLessThan(
      eventEmitter.emit.mock.invocationCallOrder[0],
    );
  });

  it('does not emit when Advanced is already unlocked', async () => {
    await service.evaluateBadges(user);

    expect(userBadgeModel.updateOne).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates achievement-count failures without persisting a badge', async () => {
    const error = new Error('Failed to count achievements');
    achievementService.countUnlockedByUserId.mockRejectedValue(error);

    await expect(service.evaluateBadges(user)).rejects.toBe(error);
    expect(userBadgeModel.updateOne).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates badge persistence failures without emitting an event', async () => {
    const error = new Error('Failed to persist badge');
    userBadgeModel.updateOne.mockRejectedValue(error);

    await expect(service.evaluateBadges(user)).rejects.toBe(error);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
