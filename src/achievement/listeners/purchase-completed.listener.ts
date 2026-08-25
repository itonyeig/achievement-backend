import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventName } from '../../common/enums/event-name.enum';
import { PurchaseCompletedEvent } from '../../purchase/events/purchase-completed.event';
import { AchievementService } from '../achievement.service';

@Injectable()
export class PurchaseCompletedListener {
  constructor(private readonly achievementService: AchievementService) {}

  @OnEvent(EventName.PurchaseCompleted)
  async handle(event: PurchaseCompletedEvent): Promise<void> {
    await this.achievementService.evaluatePurchaseAchievements(event.userId);
  }
}
