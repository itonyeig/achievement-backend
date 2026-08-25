import { type INestApplication } from '@nestjs/common';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AchievementService } from '../src/achievement/achievement.service';
import type { AchievementUnlockedEvent } from '../src/achievement/events/achievement-unlocked.event';
import { PurchaseCompletedListener } from '../src/achievement/listeners/purchase-completed.listener';
import { UserAchievement } from '../src/achievement/schema/user-achievement.schema';
import { EventName } from '../src/common/enums/event-name.enum';
import { PurchaseService } from '../src/purchase/purchase.service';
import type { UserDocument } from '../src/user/schema/user.schema';
import { UserService } from '../src/user/user.service';

describe('Achievement events (e2e)', () => {
  let app: INestApplication;
  let eventEmitter: EventEmitter2;
  let receivedEvents: AchievementUnlockedEvent[];
  const userId = new Types.ObjectId('66c740862c2cb219f9b9ef11');
  const user = {
    _id: userId,
    name: 'Jane Doe',
    email: 'jane@example.com',
    accountNumber: '0000000000',
    accountName: 'Jane Doe',
    bankCode: '057',
  } as unknown as UserDocument;
  const purchaseService = {
    countByUserId: jest.fn(),
  };
  const userService = {
    findById: jest.fn(),
  };
  const userAchievementModel = {
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
  };
  const achievementUnlockedListener = jest.fn<
    (event: AchievementUnlockedEvent) => void
  >((event: AchievementUnlockedEvent) => {
    receivedEvents.push(event);
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        AchievementService,
        PurchaseCompletedListener,
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
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    eventEmitter = app.get(EventEmitter2);
    eventEmitter.on(EventName.AchievementUnlocked, achievementUnlockedListener);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    receivedEvents = [];
    purchaseService.countByUserId.mockResolvedValue(1);
    userService.findById.mockResolvedValue(user);
    userAchievementModel.updateOne.mockResolvedValue({ upsertedCount: 0 });
  });

  afterAll(async () => {
    eventEmitter.off(
      EventName.AchievementUnlocked,
      achievementUnlockedListener,
    );
    await app.close();
  });

  it('unlocks and emits First Purchase after a first purchase event', async () => {
    userAchievementModel.updateOne.mockResolvedValue({ upsertedCount: 1 });

    await eventEmitter.emitAsync(EventName.PurchaseCompleted, { userId });

    expect(purchaseService.countByUserId).toHaveBeenCalledWith(userId);
    expect(userService.findById).toHaveBeenCalledWith(userId);
    expect(userAchievementModel.updateOne).toHaveBeenCalledTimes(1);
    expect(achievementUnlockedListener).toHaveBeenCalledTimes(1);
    expect(achievementUnlockedListener).toHaveBeenCalledWith({
      achievement_name: 'First Purchase',
      user,
    });

    const [event] = receivedEvents;

    if (!event) {
      throw new Error('AchievementUnlocked event was not received');
    }

    expect(Object.keys(event)).toEqual(['achievement_name', 'user']);
    expect(event.user).toBe(user);
  });

  it('emits only 5 Purchases when First Purchase already exists', async () => {
    purchaseService.countByUserId.mockResolvedValue(5);
    userAchievementModel.updateOne.mockResolvedValue({ upsertedCount: 1 });

    await eventEmitter.emitAsync(EventName.PurchaseCompleted, { userId });

    expect(achievementUnlockedListener).toHaveBeenCalledTimes(1);
    expect(achievementUnlockedListener).toHaveBeenCalledWith({
      achievement_name: '5 Purchases',
      user,
    });
  });

  it('does not emit when the exact achievement already exists', async () => {
    await eventEmitter.emitAsync(EventName.PurchaseCompleted, { userId });

    expect(userAchievementModel.updateOne).toHaveBeenCalledTimes(1);
    expect(achievementUnlockedListener).not.toHaveBeenCalled();
  });

  it('does not query or persist achievements outside an exact threshold', async () => {
    purchaseService.countByUserId.mockResolvedValue(4);

    await eventEmitter.emitAsync(EventName.PurchaseCompleted, { userId });

    expect(userService.findById).not.toHaveBeenCalled();
    expect(userAchievementModel.updateOne).not.toHaveBeenCalled();
    expect(achievementUnlockedListener).not.toHaveBeenCalled();
  });
});
