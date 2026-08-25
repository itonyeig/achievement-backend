import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventName } from '../common/enums/event-name.enum';
import { PurchaseService } from '../purchase/purchase.service';
import { UserService } from '../user/user.service';
import {
  PURCHASE_ACHIEVEMENTS,
  type PurchaseAchievementDefinition,
} from './constants/achievement.constants';
import { AchievementUnlockedEvent } from './events/achievement-unlocked.event';
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
    const eligibleAchievements: readonly PurchaseAchievementDefinition[] =
      PURCHASE_ACHIEVEMENTS.filter(
        ({ threshold }) => threshold <= purchaseCount,
      );

    if (eligibleAchievements.length === 0) {
      return;
    }

    const user = await this.userService.findById(userId);
    const achievementUserId =
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const unlockedAt = new Date();
    const operations = eligibleAchievements.map((achievement) => ({
      updateOne: {
        filter: {
          userId: achievementUserId,
          achievementName: achievement.name,
        },
        update: {
          $setOnInsert: {
            userId: achievementUserId,
            achievementName: achievement.name,
            unlockedAt,
          },
        },
        upsert: true,
      },
    }));
    const result = await this.userAchievementModel.bulkWrite(operations);

    for (const operationIndex of Object.keys(result.upsertedIds)) {
      const achievement = eligibleAchievements[Number(operationIndex)];

      this.eventEmitter.emit(
        EventName.AchievementUnlocked,
        new AchievementUnlockedEvent(achievement.name, user),
      );
    }
  }
}
