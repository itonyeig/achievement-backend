import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
    ]),
    PurchaseModule,
    UserModule,
  ],
  providers: [AchievementService, PurchaseCompletedListener],
})
export class AchievementModule {}
