import { EventName } from './event-name.enum';

describe('EventName', () => {
  it('defines the completed-purchase event name', () => {
    expect(EventName.PurchaseCompleted).toBe('purchase.completed');
  });
});
