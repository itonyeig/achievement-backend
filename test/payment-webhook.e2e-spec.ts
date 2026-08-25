import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import axios, { type AxiosInstance } from 'axios';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { API_PREFIX } from '../src/common/constants/app.constants';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { CashbackStatus } from '../src/payment/enums/cashback-status.enum';
import { PaystackEvent } from '../src/payment/enums/paystack-event.enum';
import { PaystackSignatureGuard } from '../src/payment/guards/paystack-signature.guard';
import type { PaystackWebhookEvent } from '../src/payment/interfaces/paystack.interface';
import { PaymentController } from '../src/payment/payment.controller';
import { PaymentService } from '../src/payment/payment.service';
import { CashbackTransaction } from '../src/payment/schema/cashback-transaction.schema';

describe('Payment webhook (e2e)', () => {
  let app: INestApplication<App>;
  let axiosCreateSpy: jest.SpiedFunction<typeof axios.create>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  const secret = 'sk_test_secret';
  const axiosInstance = { post: jest.fn() } as unknown as AxiosInstance;
  const cashbackTransactionModel = {
    updateOne: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue('https://paystack.test'),
    getOrThrow: jest.fn().mockReturnValue(secret),
  };
  const data = {
    amount: 30000,
    reference: 'cashback-reference',
    transfer_code: 'TRF_example',
  };

  beforeAll(async () => {
    axiosCreateSpy = jest.spyOn(axios, 'create').mockReturnValue(axiosInstance);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        PaymentService,
        PaystackSignatureGuard,
        {
          provide: getModelToken(CashbackTransaction.name),
          useValue: cashbackTransactionModel,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cashbackTransactionModel.updateOne.mockResolvedValue({
      matchedCount: 1,
      modifiedCount: 1,
    });
  });

  afterAll(async () => {
    await app.close();
    axiosCreateSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('acknowledges a valid success event and completes its cashback', async () => {
    const event = {
      event: PaystackEvent.TransferSuccess,
      data,
    } satisfies PaystackWebhookEvent;

    await sendWebhook(app, event, sign(event, secret)).expect(200).expect({
      requestSuccessful: true,
      sessionId: '',
      responseMessage: 'success',
      responseCode: '00',
    });

    expect(cashbackTransactionModel.updateOne).toHaveBeenCalledWith(
      {
        reference: 'cashback-reference',
        amount: 300,
        status: CashbackStatus.Pending,
      },
      {
        $set: {
          status: CashbackStatus.Completed,
          providerReference: 'TRF_example',
        },
      },
    );
  });

  it.each([PaystackEvent.TransferFailed, PaystackEvent.TransferReversed])(
    'marks cashback failed for a valid %s event',
    async (eventName) => {
      const event = { event: eventName, data } satisfies PaystackWebhookEvent;

      await sendWebhook(app, event, sign(event, secret)).expect(200);

      expect(cashbackTransactionModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'cashback-reference',
          status: CashbackStatus.Pending,
        }),
        {
          $set: {
            status: CashbackStatus.Failed,
            providerReference: 'TRF_example',
          },
        },
      );
    },
  );

  it('acknowledges and ignores unrelated signed events', async () => {
    const event = {
      event: 'charge.success' as PaystackEvent,
      data,
    } satisfies PaystackWebhookEvent;

    await sendWebhook(app, event, sign(event, secret)).expect(200);

    expect(cashbackTransactionModel.updateOne).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing signature', undefined],
    ['an invalid signature', 'invalid-signature'],
  ])('rejects %s without processing cashback', async (_scenario, signature) => {
    const event = {
      event: PaystackEvent.TransferSuccess,
      data,
    } satisfies PaystackWebhookEvent;

    await sendWebhook(app, event, signature).expect(401);

    expect(cashbackTransactionModel.updateOne).not.toHaveBeenCalled();
  });

  it('rejects a signature that does not match the delivered body', async () => {
    const signedEvent = {
      event: PaystackEvent.TransferSuccess,
      data,
    } satisfies PaystackWebhookEvent;
    const deliveredEvent = {
      ...signedEvent,
      event: PaystackEvent.TransferFailed,
    } satisfies PaystackWebhookEvent;

    await sendWebhook(app, deliveredEvent, sign(signedEvent, secret)).expect(
      401,
    );

    expect(cashbackTransactionModel.updateOne).not.toHaveBeenCalled();
  });
});

function sign(event: PaystackWebhookEvent, secret: string): string {
  return createHmac('sha512', secret)
    .update(JSON.stringify(event))
    .digest('hex');
}

function sendWebhook(
  app: INestApplication<App>,
  event: PaystackWebhookEvent,
  signature?: string,
): request.Test {
  const webhookRequest = request(app.getHttpServer())
    .post('/api/v1/payment/webhook')
    .send(event);

  return signature
    ? webhookRequest.set('x-paystack-signature', signature)
    : webhookRequest;
}
