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

  const get = jest.fn();
  const post = jest.fn();
  const axiosInstance = { get, post } as unknown as AxiosInstance;
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

  describe('getSupportedBanks', () => {
    it('returns only bank names and codes for Nigerian NGN banks', async () => {
      get.mockResolvedValue({
        data: {
          status: true,
          message: 'Banks retrieved',
          data: [
            { name: 'Access Bank', code: '044', slug: 'access-bank' },
            { name: 'Guaranty Trust Bank', code: '058', slug: 'gtbank' },
          ],
        },
      });

      await expect(service.getSupportedBanks()).resolves.toEqual([
        { name: 'Access Bank', code: '044' },
        { name: 'Guaranty Trust Bank', code: '058' },
      ]);
      expect(get).toHaveBeenCalledWith('/bank', {
        params: { country: 'nigeria', currency: 'NGN' },
      });
    });

    it('returns an empty array when Paystack has no supported banks', async () => {
      get.mockResolvedValue({
        data: { status: true, message: 'Banks retrieved', data: [] },
      });

      await expect(service.getSupportedBanks()).resolves.toEqual([]);
    });

    it('preserves useful Paystack client errors', async () => {
      get.mockRejectedValue(
        createAxiosError(401, 'Invalid Paystack credentials'),
      );

      await expectHttpException(
        service.getSupportedBanks(),
        401,
        'Invalid Paystack credentials',
      );
    });

    it('returns a bad gateway error for malformed successful responses', async () => {
      get.mockResolvedValue({ data: { status: true } });

      await expect(service.getSupportedBanks()).rejects.toThrow(
        new BadGatewayException('Failed to retrieve supported banks'),
      );
    });
  });

  describe('resolveBankAccount', () => {
    it('returns normalized resolved account details', async () => {
      get.mockResolvedValue({
        data: {
          status: true,
          message: 'Account number resolved',
          data: {
            account_number: '0123456789',
            account_name: 'Jane Doe',
            bank_id: 9,
          },
        },
      });

      await expect(
        service.resolveBankAccount('0123456789', '058'),
      ).resolves.toEqual({
        accountNumber: '0123456789',
        accountName: 'Jane Doe',
        bankCode: '058',
      });
      expect(get).toHaveBeenCalledWith('/bank/resolve', {
        params: {
          account_number: '0123456789',
          bank_code: '058',
        },
      });
    });

    it('uses the operation fallback when Paystack omits a client-error message', async () => {
      get.mockRejectedValue(createAxiosError(422));

      await expectHttpException(
        service.resolveBankAccount('0123456789', '058'),
        422,
        'Failed to resolve bank account',
      );
    });

    it('returns a bad gateway error for network failures', async () => {
      get.mockRejectedValue(createAxiosError());

      await expect(
        service.resolveBankAccount('0123456789', '058'),
      ).rejects.toThrow(
        new BadGatewayException('Failed to resolve bank account'),
      );
    });
  });

  describe('createTransferRecipient', () => {
    const account = {
      accountNumber: '0123456789',
      accountName: 'Jane Doe',
      bankCode: '058',
    };

    it('creates a Nigerian NUBAN recipient and returns its code', async () => {
      post.mockResolvedValue({
        data: {
          status: true,
          message: 'Transfer recipient created successfully',
          data: { recipient_code: 'RCP_example' },
        },
      });

      await expect(service.createTransferRecipient(account)).resolves.toEqual({
        recipientCode: 'RCP_example',
      });
      expect(post).toHaveBeenCalledWith('/transferrecipient', {
        type: 'nuban',
        name: 'Jane Doe',
        account_number: '0123456789',
        bank_code: '058',
        currency: 'NGN',
      });
    });

    it('preserves transfer-recipient client errors', async () => {
      post.mockRejectedValue(createAxiosError(400, 'Invalid bank code'));

      await expectHttpException(
        service.createTransferRecipient(account),
        400,
        'Invalid bank code',
      );
    });

    it('returns a bad gateway error for Paystack server failures', async () => {
      post.mockRejectedValue(createAxiosError(500, 'Paystack unavailable'));

      await expect(service.createTransferRecipient(account)).rejects.toThrow(
        new BadGatewayException('Failed to create transfer recipient'),
      );
    });

    it('returns a bad gateway error for unexpected failures', async () => {
      post.mockRejectedValue(new Error('Unexpected failure'));

      await expect(service.createTransferRecipient(account)).rejects.toThrow(
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
