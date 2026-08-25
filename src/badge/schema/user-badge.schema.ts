import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from 'mongoose';
import { User } from '../../user/schema/user.schema';
import { BADGE_NAMES, type BadgeName } from '../constants/badge.constants';

export type UserBadgeDocument = HydratedDocument<UserBadge>;

@Schema({ collection: 'user_badges' })
export class UserBadge {
  readonly _id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, enum: BADGE_NAMES })
  badgeName: BadgeName;

  @Prop({ required: true, default: Date.now })
  unlockedAt: Date;
}

export const UserBadgeSchema = SchemaFactory.createForClass(UserBadge);

UserBadgeSchema.index({ userId: 1, badgeName: 1 }, { unique: true });
