import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventName } from '../common/enums/event-name.enum';
import { PurchaseService } from '../purchase/purchase.service';
import { UserService } from '../user/user.service';
import { PURCHASE_ACHIEVEMENTS } from './constants/achievement.constants';
import type { AchievementUnlockedEvent } from './events/achievement-unlocked.event';
import { UserAchievement } from './schema/user-achievement.schema';

@Injectable()
export class AchievementService {
  constructor(
    @InjectModel(UserAchievement.name)
    private readonly userAchievementModel: Model<UserAchievement>,
    private readonly purchaseService: PurchaseService,
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async evaluatePurchaseAchievements(
    userId: string | Types.ObjectId,
  ): Promise<void> {
    const purchaseCount = await this.purchaseService.countByUserId(userId);
    const achievement = PURCHASE_ACHIEVEMENTS.find(
      ({ threshold }) => threshold === purchaseCount,
    );

    if (!achievement) {
      return;
    }

    const user = await this.userService.findById(userId);
    const achievementUserId =
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const unlockedAt = new Date();
    const result = await this.userAchievementModel.updateOne(
      {
        userId: achievementUserId,
        achievementName: achievement.name,
      },
      {
        $setOnInsert: {
          userId: achievementUserId,
          achievementName: achievement.name,
          unlockedAt,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount === 1) {
      this.eventEmitter.emit(EventName.AchievementUnlocked, {
        achievement_name: achievement.name,
        user,
      } satisfies AchievementUnlockedEvent);
    }
  }

  async countUnlockedByUserId(
    userId: string | Types.ObjectId,
  ): Promise<number> {
    return this.userAchievementModel.countDocuments({ userId });
  }
}
