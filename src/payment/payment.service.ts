import { BadGatewayException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import axios, { type AxiosInstance } from 'axios';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import type { BadgeUnlockedEvent } from '../badge/events/badge-unlocked.event';
import {
  CASHBACK_AMOUNT_KOBO,
  CASHBACK_AMOUNT_NAIRA,
} from './constants/cashback.constants';
import { CashbackStatus } from './enums/cashback-status.enum';
import { PaystackEvent } from './enums/paystack-event.enum';
import type {
  CreateTransferRecipientInput,
  InitiatedTransfer,
  InitiateTransferInput,
  PaystackErrorResponse,
  PaystackResponse,
  PaystackTransfer,
  PaystackTransferRecipient,
  PaystackWebhookEvent,
  TransferRecipient,
} from './interfaces/paystack.interface';
import { CashbackTransaction } from './schema/cashback-transaction.schema';

@Injectable()
export class PaymentService {
  private readonly axiosInstance: AxiosInstance;

  constructor(
    configService: ConfigService,
    @InjectModel(CashbackTransaction.name)
    private readonly cashbackTransactionModel: Model<CashbackTransaction>,
  ) {
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

  async initiateTransfer(
    input: InitiateTransferInput,
  ): Promise<InitiatedTransfer> {
    try {
      const response = await this.axiosInstance.post<
        PaystackResponse<PaystackTransfer>
      >('/transfer', {
        source: 'balance',
        amount: input.amountInKobo,
        recipient: input.recipientCode,
        reference: input.reference,
        reason: input.reason,
        currency: 'NGN',
      });

      return {
        providerReference: response.data.data.transfer_code,
      };
    } catch (error: unknown) {
      this.handleProviderError(error, 'Failed to initiate cashback transfer');
    }
  }

  async sendBadgeCashback(event: BadgeUnlockedEvent): Promise<void> {
    const reference = `cashback-${randomUUID()}`;
    const transactionFilter = {
      userId: event.user._id,
      badgeName: event.badge_name,
    };
    const result = await this.cashbackTransactionModel.updateOne(
      transactionFilter,
      {
        $setOnInsert: {
          ...transactionFilter,
          amount: CASHBACK_AMOUNT_NAIRA,
          reference,
          status: CashbackStatus.Pending,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount !== 1) {
      return;
    }

    let providerReference: string;

    try {
      const transfer = await this.initiateTransfer({
        amountInKobo: CASHBACK_AMOUNT_KOBO,
        recipientCode: event.user.recipientCode,
        reference,
        reason: `Cashback for unlocking the ${event.badge_name} badge`,
      });
      providerReference = transfer.providerReference;
    } catch (error: unknown) {
      await this.cashbackTransactionModel.updateOne(transactionFilter, {
        $set: { status: CashbackStatus.Failed },
      });
      throw error;
    }

    await this.cashbackTransactionModel.updateOne(transactionFilter, {
      $set: { providerReference },
    });
  }

  async processWebhook(event: PaystackWebhookEvent): Promise<void> {
    let status: CashbackStatus;

    switch (event.event) {
      case PaystackEvent.TransferSuccess:
        status = CashbackStatus.Completed;
        break;
      case PaystackEvent.TransferFailed:
      case PaystackEvent.TransferReversed:
        status = CashbackStatus.Failed;
        break;
      default:
        return;
    }

    await this.cashbackTransactionModel.updateOne(
      {
        reference: event.data.reference,
        amount: event.data.amount / 100,
        status: CashbackStatus.Pending,
      },
      {
        $set: {
          status,
          providerReference: event.data.transfer_code,
        },
      },
    );
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
