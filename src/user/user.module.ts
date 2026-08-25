import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  UserAchievement,
  UserAchievementSchema,
} from '../achievement/schema/user-achievement.schema';
import { UserBadge, UserBadgeSchema } from '../badge/schema/user-badge.schema';
import { PaymentModule } from '../payment/payment.module';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User, UserSchema } from './schema/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserAchievement.name, schema: UserAchievementSchema },
      { name: UserBadge.name, schema: UserBadgeSchema },
    ]),
    PaymentModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
