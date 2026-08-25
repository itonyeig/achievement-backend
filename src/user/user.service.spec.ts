import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { UserAchievement } from '../achievement/schema/user-achievement.schema';
import { UserBadge } from '../badge/schema/user-badge.schema';
import { PaymentService } from '../payment/payment.service';
import { User } from './schema/user.schema';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  const userModel = {
    create: jest.fn(),
    exists: jest.fn(),
    findById: jest.fn(),
  };
  const userFindByIdExec = jest.fn();
  const userFindByIdSelect = jest.fn(() => ({ exec: userFindByIdExec }));
  const userAchievementExec = jest.fn();
  const userAchievementLean = jest.fn(() => ({
    exec: userAchievementExec,
  }));
  const userAchievementSelect = jest.fn(() => ({
    lean: userAchievementLean,
  }));
  const userAchievementModel = {
    find: jest.fn(() => ({ select: userAchievementSelect })),
  };
  const userBadgeExec = jest.fn();
  const userBadgeLean = jest.fn(() => ({ exec: userBadgeExec }));
  const userBadgeSelect = jest.fn(() => ({ lean: userBadgeLean }));
  const userBadgeModel = {
    find: jest.fn(() => ({ select: userBadgeSelect })),
  };
  const paymentService = {
    createTransferRecipient: jest.fn(),
  };
  const createUserDto = {
    name: 'Jane Doe',
    email: 'jane@example.com',
  };
  const testRecipientInput = {
    accountName: 'Jane Doe',
    accountNumber: '0000000000',
    bankCode: '057',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
        {
          provide: getModelToken(UserAchievement.name),
          useValue: userAchievementModel,
        },
        {
          provide: getModelToken(UserBadge.name),
          useValue: userBadgeModel,
        },
        {
          provide: PaymentService,
          useValue: paymentService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
    userAchievementExec.mockResolvedValue([]);
    userBadgeExec.mockResolvedValue([]);
    userModel.findById.mockReturnValue({ select: userFindByIdSelect });
  });

  it('creates a Paystack test recipient and persists the user', async () => {
    paymentService.createTransferRecipient.mockResolvedValue({
      recipientCode: 'RCP_example',
    });
    userModel.create.mockResolvedValue({
      _id: { toString: () => '66c740862c2cb219f9b9ef11' },
      name: 'Jane Doe',
      email: 'jane@example.com',
      accountNumber: '0000000000',
      accountName: 'Jane Doe',
      bankCode: '057',
      recipientCode: 'RCP_example',
    });

    const result = await service.createUser(createUserDto);

    expect(paymentService.createTransferRecipient).toHaveBeenCalledTimes(1);
    expect(paymentService.createTransferRecipient).toHaveBeenCalledWith(
      testRecipientInput,
    );
    expect(userModel.create).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      accountNumber: '0000000000',
      accountName: 'Jane Doe',
      bankCode: '057',
      recipientCode: 'RCP_example',
    });
    expect(result).toEqual({
      _id: '66c740862c2cb219f9b9ef11',
      name: 'Jane Doe',
      email: 'jane@example.com',
      accountNumber: '0000000000',
      accountName: 'Jane Doe',
      bankCode: '057',
    });
    expect(result).not.toHaveProperty('recipientCode');
  });

  it('uses each user name as the test recipient account name', async () => {
    paymentService.createTransferRecipient.mockResolvedValue({
      recipientCode: 'RCP_another',
    });
    userModel.create.mockResolvedValue({
      _id: { toString: () => '66c740862c2cb219f9b9ef12' },
      name: 'John Smith',
      email: 'john@example.com',
      accountNumber: '0000000000',
      accountName: 'John Smith',
      bankCode: '057',
    });

    await service.createUser({
      name: 'John Smith',
      email: 'john@example.com',
    });

    expect(paymentService.createTransferRecipient).toHaveBeenCalledWith({
      ...testRecipientInput,
      accountName: 'John Smith',
    });
    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John Smith',
        accountName: 'John Smith',
        recipientCode: 'RCP_another',
      }),
    );
  });

  it('does not persist the user when recipient creation fails', async () => {
    const error = new Error('Recipient creation failed');
    paymentService.createTransferRecipient.mockRejectedValue(error);

    await expect(service.createUser(createUserDto)).rejects.toBe(error);
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('propagates database creation failures', async () => {
    const duplicateEmailError = Object.assign(new Error('Duplicate email'), {
      code: 11000,
    });
    paymentService.createTransferRecipient.mockResolvedValue({
      recipientCode: 'RCP_example',
    });
    userModel.create.mockRejectedValue(duplicateEmailError);

    await expect(service.createUser(createUserDto)).rejects.toBe(
      duplicateEmailError,
    );
  });

  describe('existsOrThrow', () => {
    it('returns the matching user identifier', async () => {
      const userId = '66c740862c2cb219f9b9ef11';
      const existingUser = { _id: userId };
      userModel.exists.mockResolvedValue(existingUser);

      await expect(service.existsOrThrow(userId)).resolves.toBe(existingUser);
      expect(userModel.exists).toHaveBeenCalledWith({ _id: userId });
    });

    it('throws when the user does not exist', async () => {
      userModel.exists.mockResolvedValue(null);

      await expect(
        service.existsOrThrow('66c740862c2cb219f9b9ef11'),
      ).rejects.toEqual(new NotFoundException('User not found'));
    });

    it('propagates user-query failures', async () => {
      const error = new Error('Failed to query user');
      userModel.exists.mockRejectedValue(error);

      await expect(
        service.existsOrThrow('66c740862c2cb219f9b9ef11'),
      ).rejects.toBe(error);
    });
  });

  describe('findById', () => {
    const userId = '66c740862c2cb219f9b9ef11';

    it('returns the user with the payout recipient code selected', async () => {
      const user = {
        _id: userId,
        name: 'Jane Doe',
        recipientCode: 'RCP_example',
      };
      userFindByIdExec.mockResolvedValue(user);

      await expect(service.findById(userId)).resolves.toBe(user);
      expect(userModel.findById).toHaveBeenCalledWith(userId);
      expect(userFindByIdSelect).toHaveBeenCalledWith('+recipientCode');
      expect(userFindByIdExec).toHaveBeenCalledTimes(1);
    });

    it('throws when the user does not exist', async () => {
      userFindByIdExec.mockResolvedValue(null);

      await expect(service.findById(userId)).rejects.toEqual(
        new NotFoundException('User not found'),
      );
    });

    it('propagates user-query failures', async () => {
      const error = new Error('Failed to find user');
      userFindByIdExec.mockRejectedValue(error);

      await expect(service.findById(userId)).rejects.toBe(error);
    });
  });

  describe('getAchievements', () => {
    const userId = '66c740862c2cb219f9b9ef11';
    const achievementNames = [
      'First Purchase',
      '5 Purchases',
      '10 Purchases',
      '15 Purchases',
      '20 Purchases',
      '25 Purchases',
      '30 Purchases',
      '35 Purchases',
    ] as const;

    beforeEach(() => {
      userModel.exists.mockResolvedValue({ _id: userId });
    });

    it.each(
      achievementNames.map((_, unlockedCount) => [unlockedCount]).concat([[8]]),
    )(
      'returns the correct achievement and badge progress with %i unlocked achievements',
      async (unlockedCount) => {
        userAchievementExec.mockResolvedValue(
          achievementNames
            .slice(0, unlockedCount)
            .map((achievementName) => ({ achievementName })),
        );

        await expect(service.getAchievements(userId)).resolves.toEqual({
          unlocked_achievements: achievementNames.slice(0, unlockedCount),
          next_available_achievements:
            unlockedCount < achievementNames.length
              ? [achievementNames[unlockedCount]]
              : [],
          current_badge: null,
          next_badge: 'Advanced',
          remaining_to_unlock_next_badge: 8 - unlockedCount,
        });
      },
    );

    it('returns the assessment example when five achievements are unlocked', async () => {
      userAchievementExec.mockResolvedValue(
        achievementNames.slice(0, 5).map((achievementName) => ({
          achievementName,
        })),
      );

      await expect(service.getAchievements(userId)).resolves.toEqual({
        unlocked_achievements: achievementNames.slice(0, 5),
        next_available_achievements: ['25 Purchases'],
        current_badge: null,
        next_badge: 'Advanced',
        remaining_to_unlock_next_badge: 3,
      });
    });

    it('returns Advanced as current with no next badge after it is unlocked', async () => {
      userAchievementExec.mockResolvedValue(
        achievementNames.map((achievementName) => ({ achievementName })),
      );
      userBadgeExec.mockResolvedValue([{ badgeName: 'Advanced' }]);

      await expect(service.getAchievements(userId)).resolves.toEqual({
        unlocked_achievements: achievementNames,
        next_available_achievements: [],
        current_badge: 'Advanced',
        next_badge: null,
        remaining_to_unlock_next_badge: 0,
      });
    });

    it('normalizes duplicate unordered records using the configured order', async () => {
      userAchievementExec.mockResolvedValue([
        { achievementName: '10 Purchases' },
        { achievementName: 'First Purchase' },
        { achievementName: '5 Purchases' },
        { achievementName: 'First Purchase' },
      ]);

      const result = await service.getAchievements(userId);

      expect(result.unlocked_achievements).toEqual([
        'First Purchase',
        '5 Purchases',
        '10 Purchases',
      ]);
      expect(Object.keys(result)).toEqual([
        'unlocked_achievements',
        'next_available_achievements',
        'current_badge',
        'next_badge',
        'remaining_to_unlock_next_badge',
      ]);
    });

    it('queries the achievement and badge collections for the requested user', async () => {
      await service.getAchievements(userId);

      expect(userModel.exists).toHaveBeenCalledWith({ _id: userId });
      expect(userAchievementModel.find).toHaveBeenCalledWith({ userId });
      expect(userAchievementSelect).toHaveBeenCalledWith(
        'achievementName -_id',
      );
      expect(userAchievementLean).toHaveBeenCalledTimes(1);
      expect(userBadgeModel.find).toHaveBeenCalledWith({ userId });
      expect(userBadgeSelect).toHaveBeenCalledWith('badgeName -_id');
      expect(userBadgeLean).toHaveBeenCalledTimes(1);
    });

    it('does not query progress when the user does not exist', async () => {
      userModel.exists.mockResolvedValue(null);

      await expect(service.getAchievements(userId)).rejects.toEqual(
        new NotFoundException('User not found'),
      );
      expect(userAchievementModel.find).not.toHaveBeenCalled();
      expect(userBadgeModel.find).not.toHaveBeenCalled();
    });

    it('propagates user-query failures without querying progress', async () => {
      const error = new Error('Failed to query user');
      userModel.exists.mockRejectedValue(error);

      await expect(service.getAchievements(userId)).rejects.toBe(error);
      expect(userAchievementModel.find).not.toHaveBeenCalled();
      expect(userBadgeModel.find).not.toHaveBeenCalled();
    });

    it('propagates achievement-query failures', async () => {
      const error = new Error('Failed to query achievements');
      userAchievementExec.mockRejectedValue(error);

      await expect(service.getAchievements(userId)).rejects.toBe(error);
    });

    it('propagates badge-query failures', async () => {
      const error = new Error('Failed to query badges');
      userBadgeExec.mockRejectedValue(error);

      await expect(service.getAchievements(userId)).rejects.toBe(error);
    });
  });
});
