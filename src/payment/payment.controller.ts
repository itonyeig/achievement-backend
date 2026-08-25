import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { PaystackSignatureGuard } from './guards/paystack-signature.guard';
import type { PaystackWebhookEvent } from './interfaces/paystack.interface';
import { PaymentService } from './payment.service';

@ApiExcludeController()
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook')
  @SkipThrottle()
  @UseGuards(PaystackSignatureGuard)
  @HttpCode(HttpStatus.OK)
  async paystackWebhook(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.status(HttpStatus.OK).send({
      requestSuccessful: true,
      sessionId: '',
      responseMessage: 'success',
      responseCode: '00',
    });

    await this.paymentService.processWebhook(
      request.body as PaystackWebhookEvent,
    );
  }
}
