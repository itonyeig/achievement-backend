import {
  BadGatewayException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let axiosCreateSpy: jest.SpiedFunction<typeof axios.create>;

  const post = jest.fn();
  const axiosInstance = { post } as unknown as AxiosInstance;
  const configService = {
    get: jest.fn().mockReturnValue('https://paystack.test'),
    getOrThrow: jest.fn().mockReturnValue('sk_test_secret'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    axiosCreateSpy = jest.spyOn(axios, 'create').mockReturnValue(axiosInstance);
    service = new PaymentService(configService as unknown as ConfigService);
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

      new PaymentService(fallbackConfigService as unknown as ConfigService);

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
