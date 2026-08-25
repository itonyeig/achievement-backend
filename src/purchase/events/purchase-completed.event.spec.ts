import { Types } from 'mongoose';
import type { PurchaseCompletedEvent } from './purchase-completed.event';

describe('PurchaseCompletedEvent', () => {
  it.each([
    ['a string user ID', '66c740862c2cb219f9b9ef12'],
    ['a MongoDB ObjectId', new Types.ObjectId('66c740862c2cb219f9b9ef12')],
  ])('contains only userId for %s', (_scenario, userId) => {
    const event = { userId } satisfies PurchaseCompletedEvent;

    expect(event.userId).toBe(userId);
    expect(Object.keys(event)).toEqual(['userId']);
  });
});
