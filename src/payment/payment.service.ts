import { BadGatewayException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';
import type {
  CreateTransferRecipientInput,
  PaystackBank,
  PaystackErrorResponse,
  PaystackResolvedAccount,
  PaystackResponse,
  PaystackTransferRecipient,
  ResolvedBankAccount,
  TransferRecipient,
} from './interfaces/paystack.interface';

@Injectable()
export class PaymentService {
  private readonly axiosInstance: AxiosInstance;

  constructor(configService: ConfigService) {
    this.axiosInstance = axios.create({
      baseURL: configService.get<string>(
        'PAYSTACK_BASE_URL',
        'https://api.paystack.co',
      ),
      headers: {
        Authorization: `Bearer ${configService.getOrThrow<string>('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async getSupportedBanks(): Promise<PaystackBank[]> {
    try {
      const response = await this.axiosInstance.get<
        PaystackResponse<PaystackBank[]>
      >('/bank', {
        params: {
          country: 'nigeria',
          currency: 'NGN',
        },
      });

      return response.data.data;
    } catch (error: unknown) {
      this.handlePaystackError(error, 'Failed to retrieve supported banks');
    }
  }

  async resolveBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<ResolvedBankAccount> {
    try {
      const response = await this.axiosInstance.get<
        PaystackResponse<PaystackResolvedAccount>
      >('/bank/resolve', {
        params: {
          account_number: accountNumber,
          bank_code: bankCode,
        },
      });

      return {
        accountNumber: response.data.data.account_number,
        accountName: response.data.data.account_name,
        bankCode,
      };
    } catch (error: unknown) {
      this.handlePaystackError(error, 'Failed to resolve bank account');
    }
  }

  async createTransferRecipient(
    input: CreateTransferRecipientInput,
  ): Promise<TransferRecipient> {
    try {
      const response = await this.axiosInstance.post<
        PaystackResponse<PaystackTransferRecipient>
      >('/transferrecipient', {
        type: 'nuban',
        name: input.accountName,
        account_number: input.accountNumber,
        bank_code: input.bankCode,
        currency: 'NGN',
      });

      return {
        recipientCode: response.data.data.recipient_code,
      };
    } catch (error: unknown) {
      this.handlePaystackError(error, 'Failed to create transfer recipient');
    }
  }

  private handlePaystackError(error: unknown, fallbackMessage: string): never {
    if (axios.isAxiosError<PaystackErrorResponse>(error) && error.response) {
      const statusCode = error.response.status;

      if (statusCode >= 400 && statusCode < 500) {
        throw new HttpException(
          error.response.data?.message ?? fallbackMessage,
          statusCode,
        );
      }
    }

    throw new BadGatewayException(fallbackMessage);
  }
}
