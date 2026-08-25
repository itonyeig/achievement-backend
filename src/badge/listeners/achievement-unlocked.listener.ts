import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { AchievementUnlockedEvent } from '../../achievement/events/achievement-unlocked.event';
import { EventName } from '../../common/enums/event-name.enum';
import { BadgeService } from '../badge.service';

@Injectable()
export class AchievementUnlockedListener {
  constructor(private readonly badgeService: BadgeService) {}

  @OnEvent(EventName.AchievementUnlocked)
  async handle(event: AchievementUnlockedEvent): Promise<void> {
    await this.badgeService.evaluateBadges(event.user);
  }
}
