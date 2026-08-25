import { Types } from 'mongoose';
import { PurchaseCompletedEvent } from './purchase-completed.event';

describe('PurchaseCompletedEvent', () => {
  it.each([
    ['a string user ID', '66c740862c2cb219f9b9ef12'],
    ['a MongoDB ObjectId', new Types.ObjectId('66c740862c2cb219f9b9ef12')],
  ])('contains only userId for %s', (_scenario, userId) => {
    const event = new PurchaseCompletedEvent(userId);

    expect(event.userId).toBe(userId);
    expect(Object.keys(event)).toEqual(['userId']);
  });
});
