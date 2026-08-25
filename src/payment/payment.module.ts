import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BadgeUnlockedListener } from './listeners/badge-unlocked.listener';
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
  providers: [PaymentService, BadgeUnlockedListener],
  exports: [PaymentService],
})
export class PaymentModule {}
