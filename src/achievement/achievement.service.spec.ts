import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EventName } from '../common/enums/event-name.enum';
import { PurchaseService } from '../purchase/purchase.service';
import type { UserDocument } from '../user/schema/user.schema';
import { UserService } from '../user/user.service';
import { AchievementService } from './achievement.service';
import { AchievementUnlockedEvent } from './events/achievement-unlocked.event';
import { UserAchievement } from './schema/user-achievement.schema';

type BulkOperation = {
  updateOne: {
    filter: {
      userId: Types.ObjectId;
      achievementName: string;
    };
    update: {
      $setOnInsert: {
        userId: Types.ObjectId;
        achievementName: string;
        unlockedAt: Date;
      };
    };
    upsert: boolean;
  };
};

type BulkWriteResult = {
  upsertedIds: Record<number, Types.ObjectId>;
};

describe('AchievementService', () => {
  let service: AchievementService;
  let persistedOperations: BulkOperation[];
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
    bulkWrite:
      jest.fn<(operations: BulkOperation[]) => Promise<BulkWriteResult>>(),
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
    persistedOperations = [];
    emittedEvents = [];
    purchaseService.countByUserId.mockResolvedValue(1);
    userService.findById.mockResolvedValue(user);
    userAchievementModel.bulkWrite.mockImplementation(
      (operations: BulkOperation[]) => {
        persistedOperations = operations;
        return Promise.resolve({ upsertedIds: {} });
      },
    );
    eventEmitter.emit.mockImplementation(
      (_eventName: string, event: AchievementUnlockedEvent) => {
        emittedEvents.push(event);
        return true;
      },
    );
  });

  it('does nothing when the user has made no purchases', async () => {
    purchaseService.countByUserId.mockResolvedValue(0);

    await service.evaluatePurchaseAchievements(userId);

    expect(purchaseService.countByUserId).toHaveBeenCalledWith(userId);
    expect(userService.findById).not.toHaveBeenCalled();
    expect(userAchievementModel.bulkWrite).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it.each([
    { purchaseCount: 1, names: ['First Purchase'] },
    { purchaseCount: 4, names: ['First Purchase'] },
    { purchaseCount: 5, names: ['First Purchase', '5 Purchases'] },
    { purchaseCount: 9, names: ['First Purchase', '5 Purchases'] },
    {
      purchaseCount: 10,
      names: ['First Purchase', '5 Purchases', '10 Purchases'],
    },
    {
      purchaseCount: 14,
      names: ['First Purchase', '5 Purchases', '10 Purchases'],
    },
    {
      purchaseCount: 15,
      names: ['First Purchase', '5 Purchases', '10 Purchases', '15 Purchases'],
    },
    {
      purchaseCount: 19,
      names: ['First Purchase', '5 Purchases', '10 Purchases', '15 Purchases'],
    },
    {
      purchaseCount: 20,
      names: [
        'First Purchase',
        '5 Purchases',
        '10 Purchases',
        '15 Purchases',
        '20 Purchases',
      ],
    },
    {
      purchaseCount: 24,
      names: [
        'First Purchase',
        '5 Purchases',
        '10 Purchases',
        '15 Purchases',
        '20 Purchases',
      ],
    },
    {
      purchaseCount: 25,
      names: [
        'First Purchase',
        '5 Purchases',
        '10 Purchases',
        '15 Purchases',
        '20 Purchases',
        '25 Purchases',
      ],
    },
    {
      purchaseCount: 29,
      names: [
        'First Purchase',
        '5 Purchases',
        '10 Purchases',
        '15 Purchases',
        '20 Purchases',
        '25 Purchases',
      ],
    },
    {
      purchaseCount: 30,
      names: [
        'First Purchase',
        '5 Purchases',
        '10 Purchases',
        '15 Purchases',
        '20 Purchases',
        '25 Purchases',
        '30 Purchases',
      ],
    },
    {
      purchaseCount: 34,
      names: [
        'First Purchase',
        '5 Purchases',
        '10 Purchases',
        '15 Purchases',
        '20 Purchases',
        '25 Purchases',
        '30 Purchases',
      ],
    },
    {
      purchaseCount: 35,
      names: [
        'First Purchase',
        '5 Purchases',
        '10 Purchases',
        '15 Purchases',
        '20 Purchases',
        '25 Purchases',
        '30 Purchases',
        '35 Purchases',
      ],
    },
    {
      purchaseCount: 40,
      names: [
        'First Purchase',
        '5 Purchases',
        '10 Purchases',
        '15 Purchases',
        '20 Purchases',
        '25 Purchases',
        '30 Purchases',
        '35 Purchases',
      ],
    },
  ])(
    'builds one bulk upsert for every milestone reached at $purchaseCount purchases',
    async ({ purchaseCount, names }) => {
      purchaseService.countByUserId.mockResolvedValue(purchaseCount);

      await service.evaluatePurchaseAchievements(userId);

      expect(userService.findById).toHaveBeenCalledWith(userId);
      expect(userAchievementModel.bulkWrite).toHaveBeenCalledTimes(1);
      expect(
        persistedOperations.map(({ updateOne }) => ({
          filter: updateOne.filter,
          insertedUserId: updateOne.update.$setOnInsert.userId,
          insertedAchievementName:
            updateOne.update.$setOnInsert.achievementName,
          upsert: updateOne.upsert,
        })),
      ).toEqual(
        names.map((achievementName) => ({
          filter: { userId: userObjectId, achievementName },
          insertedUserId: userObjectId,
          insertedAchievementName: achievementName,
          upsert: true,
        })),
      );
      expect(
        persistedOperations.every(
          ({ updateOne }) =>
            updateOne.update.$setOnInsert.unlockedAt instanceof Date,
        ),
      ).toBe(true);
    },
  );

  it('keeps an ObjectId when the event already contains one', async () => {
    await service.evaluatePurchaseAchievements(userObjectId);

    expect(persistedOperations[0].updateOne.filter.userId).toBe(userObjectId);
    expect(persistedOperations[0].updateOne.update.$setOnInsert.userId).toBe(
      userObjectId,
    );
  });

  it('emits only the achievement inserted by its matching operation index', async () => {
    purchaseService.countByUserId.mockResolvedValue(5);
    userAchievementModel.bulkWrite.mockResolvedValue({
      upsertedIds: { 1: new Types.ObjectId() },
    });

    await service.evaluatePurchaseAchievements(userId);

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventName.AchievementUnlocked,
      new AchievementUnlockedEvent('5 Purchases', user),
    );
  });

  it('recovers and emits every previously missed eligible achievement', async () => {
    purchaseService.countByUserId.mockResolvedValue(5);
    userAchievementModel.bulkWrite.mockResolvedValue({
      upsertedIds: {
        0: new Types.ObjectId(),
        1: new Types.ObjectId(),
      },
    });

    await service.evaluatePurchaseAchievements(userId);

    expect(eventEmitter.emit).toHaveBeenNthCalledWith(
      1,
      EventName.AchievementUnlocked,
      new AchievementUnlockedEvent('First Purchase', user),
    );
    expect(eventEmitter.emit).toHaveBeenNthCalledWith(
      2,
      EventName.AchievementUnlocked,
      new AchievementUnlockedEvent('5 Purchases', user),
    );
  });

  it('does not emit events when every eligible achievement already exists', async () => {
    purchaseService.countByUserId.mockResolvedValue(35);

    await service.evaluatePurchaseAchievements(userId);

    expect(userAchievementModel.bulkWrite).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('emits the exact required payload after the unlock is persisted', async () => {
    userAchievementModel.bulkWrite.mockResolvedValue({
      upsertedIds: { 0: new Types.ObjectId() },
    });

    await service.evaluatePurchaseAchievements(userId);

    const [payload] = emittedEvents;

    if (!payload) {
      throw new Error('AchievementUnlocked event was not emitted');
    }

    expect(payload).toBeInstanceOf(AchievementUnlockedEvent);
    expect(Object.keys(payload)).toEqual(['achievement_name', 'user']);
    expect(payload.achievement_name).toBe('First Purchase');
    expect(payload.user).toBe(user);
    expect(
      userAchievementModel.bulkWrite.mock.invocationCallOrder[0],
    ).toBeLessThan(eventEmitter.emit.mock.invocationCallOrder[0]);
  });

  it('propagates purchase-count failures without querying the user', async () => {
    const error = new Error('Failed to count purchases');
    purchaseService.countByUserId.mockRejectedValue(error);

    await expect(service.evaluatePurchaseAchievements(userId)).rejects.toBe(
      error,
    );
    expect(userService.findById).not.toHaveBeenCalled();
    expect(userAchievementModel.bulkWrite).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates user-query failures without persisting unlocks', async () => {
    const error = new Error('Failed to query user');
    userService.findById.mockRejectedValue(error);

    await expect(service.evaluatePurchaseAchievements(userId)).rejects.toBe(
      error,
    );
    expect(userAchievementModel.bulkWrite).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates bulk-write failures without emitting unlock events', async () => {
    const error = new Error('Failed to persist achievements');
    userAchievementModel.bulkWrite.mockRejectedValue(error);

    await expect(service.evaluatePurchaseAchievements(userId)).rejects.toBe(
      error,
    );
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
