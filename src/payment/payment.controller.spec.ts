import { HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaystackEvent } from './enums/paystack-event.enum';
import type { PaystackWebhookEvent } from './interfaces/paystack.interface';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  const event = {
    event: PaystackEvent.TransferSuccess,
    data: {
      amount: 30000,
      reference: 'cashback-reference',
      transfer_code: 'TRF_example',
    },
  } satisfies PaystackWebhookEvent;
  const paymentService = {
    processWebhook: jest.fn<(event: PaystackWebhookEvent) => Promise<void>>(),
  };
  const controller = new PaymentController(
    paymentService as unknown as PaymentService,
  );
  const status = jest.fn().mockReturnThis();
  const send = jest.fn();
  const response = {
    status,
    send,
  } as unknown as Response;
  const request = { body: event } as Request;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentService.processWebhook.mockResolvedValue();
  });

  it('acknowledges Paystack before processing the webhook body', async () => {
    await controller.paystackWebhook(request, response);

    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(send).toHaveBeenCalledWith({
      requestSuccessful: true,
      sessionId: '',
      responseMessage: 'success',
      responseCode: '00',
    });
    expect(paymentService.processWebhook).toHaveBeenCalledTimes(1);
    expect(paymentService.processWebhook).toHaveBeenCalledWith(event);
    expect(send.mock.invocationCallOrder[0]).toBeLessThan(
      paymentService.processWebhook.mock.invocationCallOrder[0],
    );
  });

  it('has already acknowledged Paystack if later processing fails', async () => {
    const error = new Error('Failed to process webhook');
    paymentService.processWebhook.mockRejectedValue(error);

    await expect(controller.paystackWebhook(request, response)).rejects.toBe(
      error,
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
});
