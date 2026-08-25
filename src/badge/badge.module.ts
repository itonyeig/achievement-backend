import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AchievementModule } from '../achievement/achievement.module';
import { BadgeService } from './badge.service';
import { AchievementUnlockedListener } from './listeners/achievement-unlocked.listener';
import { UserBadge, UserBadgeSchema } from './schema/user-badge.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserBadge.name, schema: UserBadgeSchema },
    ]),
    AchievementModule,
  ],
  providers: [BadgeService, AchievementUnlockedListener],
})
export class BadgeModule {}
