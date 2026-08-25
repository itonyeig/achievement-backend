import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EventName } from '../common/enums/event-name.enum';
import { PurchaseService } from '../purchase/purchase.service';
import type { UserDocument } from '../user/schema/user.schema';
import { UserService } from '../user/user.service';
import { AchievementService } from './achievement.service';
import type { AchievementName } from './constants/achievement.constants';
import type { AchievementUnlockedEvent } from './events/achievement-unlocked.event';
import { UserAchievement } from './schema/user-achievement.schema';

type UpdateFilter = {
  userId: Types.ObjectId;
  achievementName: AchievementName;
};

type UpdateDocument = {
  $setOnInsert: UpdateFilter & { unlockedAt: Date };
};

type UpdateOneArguments = [
  filter: UpdateFilter,
  update: UpdateDocument,
  options: { upsert: boolean },
];

describe('AchievementService', () => {
  let service: AchievementService;
  let emittedEvents: AchievementUnlockedEvent[];
  const userId = '66c740862c2cb219f9b9ef11';
  const userObjectId = new Types.ObjectId(userId);
  const user = {
    _id: userObjectId,
    name: 'Jane Doe',
    email: 'jane@example.com',
    accountNumber: '0000000000',
    accountName: 'Jane Doe',
    bankCode: '057',
  } as unknown as UserDocument;
  const purchaseService = {
    countByUserId:
      jest.fn<(userId: string | Types.ObjectId) => Promise<number>>(),
  };
  const userService = {
    findById:
      jest.fn<(userId: string | Types.ObjectId) => Promise<UserDocument>>(),
  };
  const userAchievementModel = {
    updateOne:
      jest.fn<
        (
          filter: UpdateFilter,
          update: UpdateDocument,
          options: { upsert: boolean },
        ) => Promise<{ upsertedCount: number }>
      >(),
    countDocuments:
      jest.fn<
        (filter: { userId: string | Types.ObjectId }) => Promise<number>
      >(),
  };
  const eventEmitter = {
    emit: jest.fn<
      (eventName: string, event: AchievementUnlockedEvent) => boolean
    >(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementService,
        {
          provide: getModelToken(UserAchievement.name),
          useValue: userAchievementModel,
        },
        {
          provide: PurchaseService,
          useValue: purchaseService,
        },
        {
          provide: UserService,
          useValue: userService,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get<AchievementService>(AchievementService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    emittedEvents = [];
    purchaseService.countByUserId.mockResolvedValue(1);
    userService.findById.mockResolvedValue(user);
    userAchievementModel.updateOne.mockResolvedValue({ upsertedCount: 0 });
    userAchievementModel.countDocuments.mockResolvedValue(0);
    eventEmitter.emit.mockImplementation(
      (_eventName: string, event: AchievementUnlockedEvent) => {
        emittedEvents.push(event);
        return true;
      },
    );
  });

  it.each([
    [1, 'First Purchase'],
    [5, '5 Purchases'],
    [10, '10 Purchases'],
    [15, '15 Purchases'],
    [20, '20 Purchases'],
    [25, '25 Purchases'],
    [30, '30 Purchases'],
    [35, '35 Purchases'],
  ])(
    'upserts only the achievement at the exact %i-purchase threshold',
    async (purchaseCount, achievementName) => {
      purchaseService.countByUserId.mockResolvedValue(purchaseCount);

      await service.evaluatePurchaseAchievements(userId);

      expect(userService.findById).toHaveBeenCalledWith(userId);
      expect(userAchievementModel.updateOne).toHaveBeenCalledTimes(1);
      const [filter, update, options] = userAchievementModel.updateOne.mock
        .calls[0] as unknown as UpdateOneArguments;

      expect(filter).toEqual({ userId: userObjectId, achievementName });
      expect(update).toEqual({
        $setOnInsert: {
          userId: userObjectId,
          achievementName,
          unlockedAt: expect.any(Date) as Date,
        },
      });
      expect(options).toEqual({ upsert: true });
    },
  );

  it.each([0, 2, 4, 6, 9, 11, 14, 16, 19, 21, 24, 26, 29, 31, 34, 36, 40])(
    'does nothing at the non-threshold purchase count %i',
    async (purchaseCount) => {
      purchaseService.countByUserId.mockResolvedValue(purchaseCount);

      await service.evaluatePurchaseAchievements(userId);

      expect(purchaseService.countByUserId).toHaveBeenCalledWith(userId);
      expect(userService.findById).not.toHaveBeenCalled();
      expect(userAchievementModel.updateOne).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    },
  );

  it('keeps an ObjectId when the event already contains one', async () => {
    await service.evaluatePurchaseAchievements(userObjectId);

    const [filter, update] = userAchievementModel.updateOne.mock
      .calls[0] as unknown as UpdateOneArguments;
    expect(filter.userId).toBe(userObjectId);
    expect(update.$setOnInsert.userId).toBe(userObjectId);
  });

  it('emits the exact required payload after a new unlock is persisted', async () => {
    userAchievementModel.updateOne.mockResolvedValue({ upsertedCount: 1 });

    await service.evaluatePurchaseAchievements(userId);

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventName.AchievementUnlocked,
      { achievement_name: 'First Purchase', user },
    );

    const [payload] = emittedEvents;

    if (!payload) {
      throw new Error('AchievementUnlocked event was not emitted');
    }

    expect(Object.keys(payload)).toEqual(['achievement_name', 'user']);
    expect(payload.user).toBe(user);
    expect(
      userAchievementModel.updateOne.mock.invocationCallOrder[0],
    ).toBeLessThan(eventEmitter.emit.mock.invocationCallOrder[0]);
  });

  it('does not emit when the exact achievement already exists', async () => {
    await service.evaluatePurchaseAchievements(userId);

    expect(userAchievementModel.updateOne).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('counts unlocked achievements for a user', async () => {
    userAchievementModel.countDocuments.mockResolvedValue(5);

    await expect(service.countUnlockedByUserId(userObjectId)).resolves.toBe(5);
    expect(userAchievementModel.countDocuments).toHaveBeenCalledWith({
      userId: userObjectId,
    });
  });

  it('propagates purchase-count failures without querying the user', async () => {
    const error = new Error('Failed to count purchases');
    purchaseService.countByUserId.mockRejectedValue(error);

    await expect(service.evaluatePurchaseAchievements(userId)).rejects.toBe(
      error,
    );
    expect(userService.findById).not.toHaveBeenCalled();
    expect(userAchievementModel.updateOne).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates user-query failures without persisting an unlock', async () => {
    const error = new Error('Failed to query user');
    userService.findById.mockRejectedValue(error);

    await expect(service.evaluatePurchaseAchievements(userId)).rejects.toBe(
      error,
    );
    expect(userAchievementModel.updateOne).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates update failures without emitting an unlock event', async () => {
    const error = new Error('Failed to persist achievement');
    userAchievementModel.updateOne.mockRejectedValue(error);

    await expect(service.evaluatePurchaseAchievements(userId)).rejects.toBe(
      error,
    );
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
