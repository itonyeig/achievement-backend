import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  const userService = {
    createUser: jest.fn(),
    getAchievements: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: userService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    jest.clearAllMocks();
  });

  it('creates a user through the user service', async () => {
    const dto = {
      name: 'Jane Doe',
      email: 'jane@example.com',
    };
    const user = {
      _id: '66c740862c2cb219f9b9ef11',
      ...dto,
      accountNumber: '0000000000',
      accountName: 'Jane Doe',
      bankCode: '057',
    };
    userService.createUser.mockResolvedValue(user);

    await expect(controller.createUser(dto)).resolves.toEqual(user);
    expect(userService.createUser).toHaveBeenCalledWith(dto);
  });

  it('propagates user-creation failures', async () => {
    const error = new BadGatewayException(
      'Failed to create transfer recipient',
    );
    userService.createUser.mockRejectedValue(error);

    await expect(
      controller.createUser({
        name: 'Jane Doe',
        email: 'jane@example.com',
      }),
    ).rejects.toBe(error);
  });

  it('gets achievement progress through the user service', async () => {
    const userId = '66c740862c2cb219f9b9ef11';
    const progress = {
      unlocked_achievements: ['First Purchase'],
      next_available_achievements: ['5 Purchases'],
      current_badge: null,
      next_badge: 'Advanced',
      remaining_to_unlock_next_badge: 7,
    };
    userService.getAchievements.mockResolvedValue(progress);

    await expect(controller.getAchievements({ user: userId })).resolves.toEqual(
      progress,
    );
    expect(userService.getAchievements).toHaveBeenCalledWith(userId);
  });

  it('propagates achievement-progress failures', async () => {
    const error = new Error('Failed to query progress');
    userService.getAchievements.mockRejectedValue(error);

    await expect(
      controller.getAchievements({ user: '66c740862c2cb219f9b9ef11' }),
    ).rejects.toBe(error);
  });
});
