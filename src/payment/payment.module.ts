import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaystackSignatureGuard } from './guards/paystack-signature.guard';
import { BadgeUnlockedListener } from './listeners/badge-unlocked.listener';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import {
  CashbackTransaction,
  CashbackTransactionSchema,
} from './schema/cashback-transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: CashbackTransaction.name,
        schema: CashbackTransactionSchema,
      },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, BadgeUnlockedListener, PaystackSignatureGuard],
  exports: [PaymentService],
})
export class PaymentModule {}
