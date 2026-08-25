import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from '../payment/payment.service';
import { User } from './schema/user.schema';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  const userModel = {
    create: jest.fn(),
    exists: jest.fn(),
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
          provide: PaymentService,
          useValue: paymentService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
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
});
