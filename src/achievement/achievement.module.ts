import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BadgeService } from '../badge/badge.service';
import { AchievementUnlockedListener } from '../badge/listeners/achievement-unlocked.listener';
import { UserBadge, UserBadgeSchema } from '../badge/schema/user-badge.schema';
import { PurchaseModule } from '../purchase/purchase.module';
import { UserModule } from '../user/user.module';
import { AchievementService } from './achievement.service';
import { PurchaseCompletedListener } from './listeners/purchase-completed.listener';
import {
  UserAchievement,
  UserAchievementSchema,
} from './schema/user-achievement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserAchievement.name, schema: UserAchievementSchema },
      { name: UserBadge.name, schema: UserBadgeSchema },
    ]),
    PurchaseModule,
    UserModule,
  ],
  providers: [
    AchievementService,
    BadgeService,
    PurchaseCompletedListener,
    AchievementUnlockedListener,
  ],
  exports: [AchievementService],
})
export class AchievementModule {}
