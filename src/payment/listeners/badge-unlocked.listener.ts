import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { BadgeUnlockedEvent } from '../../badge/events/badge-unlocked.event';
import { EventName } from '../../common/enums/event-name.enum';
import { PaymentService } from '../payment.service';

@Injectable()
export class BadgeUnlockedListener {
  constructor(private readonly paymentService: PaymentService) {}

  @OnEvent(EventName.BadgeUnlocked)
  async handle(event: BadgeUnlockedEvent): Promise<void> {
    await this.paymentService.sendBadgeCashback(event);
  }
}
