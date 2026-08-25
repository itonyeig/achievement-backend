import { Types } from 'mongoose';
import type { BadgeUnlockedEvent } from '../../badge/events/badge-unlocked.event';
import type { UserDocument } from '../../user/schema/user.schema';
import { PaymentService } from '../payment.service';
import { BadgeUnlockedListener } from './badge-unlocked.listener';

describe('BadgeUnlockedListener', () => {
  const user = {
    _id: new Types.ObjectId('66c740862c2cb219f9b9ef11'),
    name: 'Jane Doe',
    recipientCode: 'RCP_example',
  } as unknown as UserDocument;
  const event = {
    badge_name: 'Advanced',
    user,
  } satisfies BadgeUnlockedEvent;
  const paymentService = {
    sendBadgeCashback: jest.fn<(event: BadgeUnlockedEvent) => Promise<void>>(),
  };
  const listener = new BadgeUnlockedListener(
    paymentService as unknown as PaymentService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    paymentService.sendBadgeCashback.mockResolvedValue();
  });

  it('sends cashback for the complete badge event', async () => {
    await listener.handle(event);

    expect(paymentService.sendBadgeCashback).toHaveBeenCalledTimes(1);
    expect(paymentService.sendBadgeCashback).toHaveBeenCalledWith(event);
  });

  it('propagates cashback failures', async () => {
    const error = new Error('Failed to send cashback');
    paymentService.sendBadgeCashback.mockRejectedValue(error);

    await expect(listener.handle(event)).rejects.toBe(error);
  });
});
