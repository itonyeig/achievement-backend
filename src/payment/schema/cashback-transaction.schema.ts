import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from 'mongoose';
import {
  BADGE_NAMES,
  type BadgeName,
} from '../../badge/constants/badge.constants';
import { User } from '../../user/schema/user.schema';
import { CashbackStatus } from '../enums/cashback-status.enum';

export type CashbackTransactionDocument = HydratedDocument<CashbackTransaction>;

@Schema({ collection: 'cashback_transactions', timestamps: true })
export class CashbackTransaction {
  readonly _id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, enum: BADGE_NAMES })
  badgeName: BadgeName;

  @Prop({ required: true, min: 1 })
  amount: number;

  @Prop({ required: true, unique: true, trim: true })
  reference: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(CashbackStatus),
    default: CashbackStatus.Pending,
  })
  status: CashbackStatus;

  @Prop({ trim: true })
  providerReference?: string;

  createdAt: Date;

  updatedAt: Date;
}

export const CashbackTransactionSchema =
  SchemaFactory.createForClass(CashbackTransaction);

CashbackTransactionSchema.index({ userId: 1, badgeName: 1 }, { unique: true });
