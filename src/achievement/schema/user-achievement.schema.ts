import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from 'mongoose';
import { User } from '../../user/schema/user.schema';

export type UserAchievementDocument = HydratedDocument<UserAchievement>;

@Schema({ collection: 'user_achievements' })
export class UserAchievement {
  readonly _id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  achievementName: string;

  @Prop({ required: true, default: Date.now })
  unlockedAt: Date;
}

export const UserAchievementSchema =
  SchemaFactory.createForClass(UserAchievement);

UserAchievementSchema.index(
  { userId: 1, achievementName: 1 },
  { unique: true },
);
