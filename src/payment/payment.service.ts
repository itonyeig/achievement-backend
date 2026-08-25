import { BadGatewayException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';
import type {
  CreateTransferRecipientInput,
  PaystackErrorResponse,
  PaystackResponse,
  PaystackTransferRecipient,
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
      this.handleProviderError(error, 'Failed to create transfer recipient');
    }
  }

  private handleProviderError(error: unknown, fallbackMessage: string): never {
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
