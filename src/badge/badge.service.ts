import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AchievementService } from '../achievement/achievement.service';
import { EventName } from '../common/enums/event-name.enum';
import type { UserDocument } from '../user/schema/user.schema';
import { BADGES } from './constants/badge.constants';
import type { BadgeUnlockedEvent } from './events/badge-unlocked.event';
import { UserBadge } from './schema/user-badge.schema';

@Injectable()
export class BadgeService {
  constructor(
    @InjectModel(UserBadge.name)
    private readonly userBadgeModel: Model<UserBadge>,
    private readonly achievementService: AchievementService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async evaluateBadges(user: UserDocument): Promise<void> {
    const achievementCount =
      await this.achievementService.countUnlockedByUserId(user._id);
    const badge = BADGES.find(
      ({ requiredAchievementCount }) =>
        requiredAchievementCount === achievementCount,
    );

    if (!badge) {
      return;
    }

    const unlockedAt = new Date();
    const result = await this.userBadgeModel.updateOne(
      { userId: user._id, badgeName: badge.name },
      {
        $setOnInsert: {
          userId: user._id,
          badgeName: badge.name,
          unlockedAt,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount === 1) {
      this.eventEmitter.emit(EventName.BadgeUnlocked, {
        badge_name: badge.name,
        user,
      } satisfies BadgeUnlockedEvent);
    }
  }
}
