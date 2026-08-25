import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import axios, { type AxiosInstance } from 'axios';
import { Types } from 'mongoose';
import { AchievementService } from '../src/achievement/achievement.service';
import { BadgeService } from '../src/badge/badge.service';
import type { BadgeUnlockedEvent } from '../src/badge/events/badge-unlocked.event';
import { AchievementUnlockedListener } from '../src/badge/listeners/achievement-unlocked.listener';
import { UserBadge } from '../src/badge/schema/user-badge.schema';
import { EventName } from '../src/common/enums/event-name.enum';
import { CashbackStatus } from '../src/payment/enums/cashback-status.enum';
import { BadgeUnlockedListener } from '../src/payment/listeners/badge-unlocked.listener';
import { PaymentService } from '../src/payment/payment.service';
import { CashbackTransaction } from '../src/payment/schema/cashback-transaction.schema';
import type { UserDocument } from '../src/user/schema/user.schema';

describe('Badge and cashback events (e2e)', () => {
  let app: INestApplication;
  let eventEmitter: EventEmitter2;
  let axiosCreateSpy: jest.SpiedFunction<typeof axios.create>;
  let receivedBadges: BadgeUnlockedEvent[];
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
  const badgeEvent = {
    badge_name: 'Advanced',
    user,
  } satisfies BadgeUnlockedEvent;
  const post = jest.fn();
  const axiosInstance = { post } as unknown as AxiosInstance;
  const achievementService = {
    countUnlockedByUserId: jest.fn<() => Promise<number>>(),
  };
  const userBadgeModel = {
    updateOne:
      jest.fn<(...args: unknown[]) => Promise<{ upsertedCount: number }>>(),
  };
  const cashbackTransactionModel = {
    updateOne:
      jest.fn<(...args: unknown[]) => Promise<{ upsertedCount: number }>>(),
  };
  const configService = {
    get: jest.fn().mockReturnValue('https://paystack.test'),
    getOrThrow: jest.fn().mockReturnValue('sk_test_secret'),
  };
  const badgeObserver = jest.fn<(event: BadgeUnlockedEvent) => void>(
    (event: BadgeUnlockedEvent) => {
      receivedBadges.push(event);
    },
  );

  beforeAll(async () => {
    axiosCreateSpy = jest.spyOn(axios, 'create').mockReturnValue(axiosInstance);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        BadgeService,
        AchievementUnlockedListener,
        PaymentService,
        BadgeUnlockedListener,
        {
          provide: getModelToken(UserBadge.name),
          useValue: userBadgeModel,
        },
        {
          provide: getModelToken(CashbackTransaction.name),
          useValue: cashbackTransactionModel,
        },
        {
          provide: AchievementService,
          useValue: achievementService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(false);
    await app.init();

    eventEmitter = app.get(EventEmitter2);
    eventEmitter.on(EventName.BadgeUnlocked, badgeObserver);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    receivedBadges = [];
    achievementService.countUnlockedByUserId.mockResolvedValue(8);
    userBadgeModel.updateOne.mockResolvedValue({ upsertedCount: 0 });
    cashbackTransactionModel.updateOne.mockResolvedValue({
      upsertedCount: 0,
    });
  });

  afterAll(async () => {
    eventEmitter.off(EventName.BadgeUnlocked, badgeObserver);
    await app.close();
    axiosCreateSpy.mockRestore();
  });

  it('processes achievement, badge, cashback, and transfer initiation in sequence', async () => {
    const cashbackRecorded = createDeferred();
    userBadgeModel.updateOne.mockResolvedValue({ upsertedCount: 1 });
    cashbackTransactionModel.updateOne
      .mockResolvedValueOnce({ upsertedCount: 1 })
      .mockImplementationOnce(() => {
        cashbackRecorded.resolve();
        return Promise.resolve({ upsertedCount: 0 });
      });
    post.mockResolvedValue({
      data: {
        status: true,
        message: 'Transfer has been queued',
        data: {
          reference: 'paystack-reference',
          status: 'pending',
          transfer_code: 'TRF_example',
        },
      },
    });

    await eventEmitter.emitAsync(EventName.AchievementUnlocked, {
      achievement_name: '35 Purchases',
      user,
    });
    await cashbackRecorded.promise;

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
    expect(receivedBadges).toEqual([badgeEvent]);
    expect(cashbackTransactionModel.updateOne).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledWith(
      '/transfer',
      expect.objectContaining({
        source: 'balance',
        amount: 30000,
        recipient: 'RCP_example',
        reference: expect.stringMatching(/^cashback-/) as string,
        reason: 'Cashback for unlocking the Advanced badge',
        currency: 'NGN',
      }),
    );
    expect(cashbackTransactionModel.updateOne).toHaveBeenLastCalledWith(
      { userId, badgeName: 'Advanced' },
      { $set: { providerReference: 'TRF_example' } },
    );
  });

  it('stops before badge persistence when the threshold is not reached', async () => {
    achievementService.countUnlockedByUserId.mockResolvedValue(7);

    await eventEmitter.emitAsync(EventName.AchievementUnlocked, {
      achievement_name: '30 Purchases',
      user,
    });

    expect(userBadgeModel.updateOne).not.toHaveBeenCalled();
    expect(receivedBadges).toEqual([]);
    expect(cashbackTransactionModel.updateOne).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('stops before cashback when the badge already exists', async () => {
    await eventEmitter.emitAsync(EventName.AchievementUnlocked, {
      achievement_name: '35 Purchases',
      user,
    });

    expect(userBadgeModel.updateOne).toHaveBeenCalledTimes(1);
    expect(receivedBadges).toEqual([]);
    expect(cashbackTransactionModel.updateOne).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('does not initiate another transfer when a badge event is replayed', async () => {
    await eventEmitter.emitAsync(EventName.BadgeUnlocked, badgeEvent);

    expect(cashbackTransactionModel.updateOne).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it('marks cashback as failed when Paystack rejects the badge transfer', async () => {
    cashbackTransactionModel.updateOne
      .mockResolvedValueOnce({ upsertedCount: 1 })
      .mockResolvedValueOnce({ upsertedCount: 0 });
    post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Paystack unavailable' } },
    });

    await eventEmitter.emitAsync(EventName.BadgeUnlocked, badgeEvent);

    expect(cashbackTransactionModel.updateOne).toHaveBeenLastCalledWith(
      { userId, badgeName: 'Advanced' },
      { $set: { status: CashbackStatus.Failed } },
    );
  });
});

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });

  return { promise, resolve };
}
