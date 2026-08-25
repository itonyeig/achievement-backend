import {
  BadGatewayException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';
import { Types, type Model } from 'mongoose';
import type { BadgeName } from '../badge/constants/badge.constants';
import type { BadgeUnlockedEvent } from '../badge/events/badge-unlocked.event';
import type { UserDocument } from '../user/schema/user.schema';
import {
  CASHBACK_AMOUNT_KOBO,
  CASHBACK_AMOUNT_NAIRA,
} from './constants/cashback.constants';
import { CashbackStatus } from './enums/cashback-status.enum';
import { PaymentService } from './payment.service';
import { CashbackTransaction } from './schema/cashback-transaction.schema';

type CashbackFilter = {
  userId: Types.ObjectId;
  badgeName: BadgeName;
};

type CashbackUpdate = {
  $setOnInsert?: CashbackFilter & {
    amount: number;
    reference: string;
    status: CashbackStatus;
  };
  $set?: {
    status?: CashbackStatus;
    providerReference?: string;
  };
};

type CashbackUpdateOneArguments = [
  filter: CashbackFilter,
  update: CashbackUpdate,
  options?: { upsert: boolean },
];

describe('PaymentService', () => {
  let service: PaymentService;
  let axiosCreateSpy: jest.SpiedFunction<typeof axios.create>;

  const post = jest.fn();
  const axiosInstance = { post } as unknown as AxiosInstance;
  const configService = {
    get: jest.fn().mockReturnValue('https://paystack.test'),
    getOrThrow: jest.fn().mockReturnValue('sk_test_secret'),
  };
  const cashbackTransactionModel = {
    updateOne:
      jest.fn<
        (
          ...args: CashbackUpdateOneArguments
        ) => Promise<{ upsertedCount: number }>
      >(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    axiosCreateSpy = jest.spyOn(axios, 'create').mockReturnValue(axiosInstance);
    service = new PaymentService(
      configService as unknown as ConfigService,
      cashbackTransactionModel as unknown as Model<CashbackTransaction>,
    );
    cashbackTransactionModel.updateOne.mockResolvedValue({
      upsertedCount: 0,
    });
  });

  afterEach(() => {
    axiosCreateSpy.mockRestore();
  });

  describe('configuration', () => {
    it('creates one reusable Axios instance with the configured credentials', () => {
      expect(axiosCreateSpy).toHaveBeenCalledTimes(1);
      expect(axiosCreateSpy).toHaveBeenCalledWith({
        baseURL: 'https://paystack.test',
        headers: {
          Authorization: 'Bearer sk_test_secret',
          'Content-Type': 'application/json',
        },
      });
    });

    it('uses the official Paystack URL when no override is configured', () => {
      const fallbackConfigService = {
        get: jest.fn((_key: string, fallback: string) => fallback),
        getOrThrow: jest.fn().mockReturnValue('sk_test_secret'),
      };

      new PaymentService(
        fallbackConfigService as unknown as ConfigService,
        cashbackTransactionModel as unknown as Model<CashbackTransaction>,
      );

      expect(axiosCreateSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ baseURL: 'https://api.paystack.co' }),
      );
    });

    it('fails during initialization when the secret key is missing', () => {
      const missingSecretConfigService = {
        get: jest.fn().mockReturnValue('https://paystack.test'),
        getOrThrow: jest.fn(() => {
          throw new InternalServerErrorException('Missing Paystack key');
        }),
      };

      expect(
        () =>
          new PaymentService(
            missingSecretConfigService as unknown as ConfigService,
            cashbackTransactionModel as unknown as Model<CashbackTransaction>,
          ),
      ).toThrow('Missing Paystack key');
    });
  });

  describe('createTransferRecipient', () => {
    const testRecipient = {
      accountNumber: '0000000000',
      accountName: 'Jane Doe',
      bankCode: '057',
    };

    it('creates the documented Nigerian test recipient and returns its code', async () => {
      post.mockResolvedValue({
        data: {
          status: true,
          message: 'Transfer recipient created successfully',
          data: { recipient_code: 'RCP_example' },
        },
      });

      await expect(
        service.createTransferRecipient(testRecipient),
      ).resolves.toEqual({ recipientCode: 'RCP_example' });
      expect(post).toHaveBeenCalledWith('/transferrecipient', {
        type: 'nuban',
        name: 'Jane Doe',
        account_number: '0000000000',
        bank_code: '057',
        currency: 'NGN',
      });
    });

    it('preserves transfer-recipient client errors', async () => {
      post.mockRejectedValue(createAxiosError(400, 'Cannot resolve account'));

      await expectHttpException(
        service.createTransferRecipient(testRecipient),
        400,
        'Cannot resolve account',
      );
    });

    it('uses the operation fallback when a client error has no message', async () => {
      post.mockRejectedValue(createAxiosError(422));

      await expectHttpException(
        service.createTransferRecipient(testRecipient),
        422,
        'Failed to create transfer recipient',
      );
    });

    it('returns a bad gateway error for Paystack server failures', async () => {
      post.mockRejectedValue(createAxiosError(500, 'Paystack unavailable'));

      await expect(
        service.createTransferRecipient(testRecipient),
      ).rejects.toThrow(
        new BadGatewayException('Failed to create transfer recipient'),
      );
    });

    it('returns a bad gateway error for network failures', async () => {
      post.mockRejectedValue(createAxiosError());

      await expect(
        service.createTransferRecipient(testRecipient),
      ).rejects.toThrow(
        new BadGatewayException('Failed to create transfer recipient'),
      );
    });

    it('returns a bad gateway error for unexpected failures', async () => {
      post.mockRejectedValue(new Error('Unexpected failure'));

      await expect(
        service.createTransferRecipient(testRecipient),
      ).rejects.toThrow(
        new BadGatewayException('Failed to create transfer recipient'),
      );
    });
  });

  describe('initiateTransfer', () => {
    const input = {
      amountInKobo: CASHBACK_AMOUNT_KOBO,
      recipientCode: 'RCP_example',
      reference: 'cashback-reference',
      reason: 'Cashback for unlocking the Advanced badge',
    };

    it('initiates a Naira balance transfer and returns its Paystack reference', async () => {
      post.mockResolvedValue({
        data: {
          status: true,
          message: 'Transfer has been queued',
          data: {
            reference: input.reference,
            status: 'pending',
            transfer_code: 'TRF_example',
          },
        },
      });

      await expect(service.initiateTransfer(input)).resolves.toEqual({
        providerReference: 'TRF_example',
      });
      expect(post).toHaveBeenCalledWith('/transfer', {
        source: 'balance',
        amount: CASHBACK_AMOUNT_KOBO,
        recipient: 'RCP_example',
        reference: 'cashback-reference',
        reason: 'Cashback for unlocking the Advanced badge',
        currency: 'NGN',
      });
    });

    it('preserves transfer client errors', async () => {
      post.mockRejectedValue(createAxiosError(400, 'Invalid recipient'));

      await expectHttpException(
        service.initiateTransfer(input),
        400,
        'Invalid recipient',
      );
    });

    it('uses the transfer fallback when a client error has no message', async () => {
      post.mockRejectedValue(createAxiosError(422));

      await expectHttpException(
        service.initiateTransfer(input),
        422,
        'Failed to initiate cashback transfer',
      );
    });

    it('returns a bad gateway error for transfer server failures', async () => {
      post.mockRejectedValue(createAxiosError(500, 'Paystack unavailable'));

      await expect(service.initiateTransfer(input)).rejects.toThrow(
        new BadGatewayException('Failed to initiate cashback transfer'),
      );
    });

    it('returns a bad gateway error for transfer network failures', async () => {
      post.mockRejectedValue(createAxiosError());

      await expect(service.initiateTransfer(input)).rejects.toThrow(
        new BadGatewayException('Failed to initiate cashback transfer'),
      );
    });

    it('returns a bad gateway error for unexpected transfer failures', async () => {
      post.mockRejectedValue(new Error('Unexpected failure'));

      await expect(service.initiateTransfer(input)).rejects.toThrow(
        new BadGatewayException('Failed to initiate cashback transfer'),
      );
    });
  });

  describe('sendBadgeCashback', () => {
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
    const event = {
      badge_name: 'Advanced',
      user,
    } satisfies BadgeUnlockedEvent;

    it('persists a pending cashback before initiating and recording the transfer', async () => {
      cashbackTransactionModel.updateOne
        .mockResolvedValueOnce({ upsertedCount: 1 })
        .mockResolvedValueOnce({ upsertedCount: 0 });
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

      await expect(service.sendBadgeCashback(event)).resolves.toBeUndefined();

      expect(cashbackTransactionModel.updateOne).toHaveBeenCalledTimes(2);
      const [, initialUpdate] = cashbackTransactionModel.updateOne.mock
        .calls[0] as unknown as CashbackUpdateOneArguments;
      const reference = initialUpdate.$setOnInsert?.reference;

      if (!reference) {
        throw new Error('Cashback reference was not persisted');
      }

      expect(reference).toMatch(/^cashback-[0-9a-f-]{36}$/);
      expect(cashbackTransactionModel.updateOne).toHaveBeenNthCalledWith(
        1,
        { userId, badgeName: 'Advanced' },
        {
          $setOnInsert: {
            userId,
            badgeName: 'Advanced',
            amount: CASHBACK_AMOUNT_NAIRA,
            reference,
            status: CashbackStatus.Pending,
          },
        },
        { upsert: true },
      );
      expect(post).toHaveBeenCalledWith('/transfer', {
        source: 'balance',
        amount: CASHBACK_AMOUNT_KOBO,
        recipient: 'RCP_example',
        reference,
        reason: 'Cashback for unlocking the Advanced badge',
        currency: 'NGN',
      });
      expect(cashbackTransactionModel.updateOne).toHaveBeenNthCalledWith(
        2,
        { userId, badgeName: 'Advanced' },
        { $set: { providerReference: 'TRF_example' } },
      );
      expect(
        cashbackTransactionModel.updateOne.mock.invocationCallOrder[0],
      ).toBeLessThan(post.mock.invocationCallOrder[0]);
      expect(post.mock.invocationCallOrder[0]).toBeLessThan(
        cashbackTransactionModel.updateOne.mock.invocationCallOrder[1],
      );
    });

    it('does not initiate another transfer when cashback already exists', async () => {
      cashbackTransactionModel.updateOne.mockResolvedValue({
        upsertedCount: 0,
      });

      await service.sendBadgeCashback(event);

      expect(cashbackTransactionModel.updateOne).toHaveBeenCalledTimes(1);
      expect(post).not.toHaveBeenCalled();
    });

    it('does not call Paystack when pending cashback persistence fails', async () => {
      const error = new Error('Failed to persist cashback');
      cashbackTransactionModel.updateOne.mockRejectedValue(error);

      await expect(service.sendBadgeCashback(event)).rejects.toBe(error);
      expect(post).not.toHaveBeenCalled();
    });

    it('marks cashback as failed when transfer initiation fails', async () => {
      cashbackTransactionModel.updateOne
        .mockResolvedValueOnce({ upsertedCount: 1 })
        .mockResolvedValueOnce({ upsertedCount: 0 });
      post.mockRejectedValue(createAxiosError(500, 'Paystack unavailable'));

      await expect(service.sendBadgeCashback(event)).rejects.toThrow(
        new BadGatewayException('Failed to initiate cashback transfer'),
      );
      expect(cashbackTransactionModel.updateOne).toHaveBeenCalledTimes(2);
      expect(cashbackTransactionModel.updateOne).toHaveBeenLastCalledWith(
        { userId, badgeName: 'Advanced' },
        { $set: { status: CashbackStatus.Failed } },
      );
    });

    it('propagates provider-reference persistence failures', async () => {
      const error = new Error('Failed to record provider reference');
      cashbackTransactionModel.updateOne
        .mockResolvedValueOnce({ upsertedCount: 1 })
        .mockRejectedValueOnce(error);
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

      await expect(service.sendBadgeCashback(event)).rejects.toBe(error);
    });
  });
});

function createAxiosError(status?: number, message?: string): unknown {
  return {
    isAxiosError: true,
    response:
      status === undefined
        ? undefined
        : {
            status,
            data: message === undefined ? {} : { status: false, message },
          },
  };
}

async function expectHttpException(
  promise: Promise<unknown>,
  status: number,
  message: string,
): Promise<void> {
  try {
    await promise;
    fail('Expected request to fail');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(status);
    expect((error as HttpException).message).toBe(message);
  }
}
