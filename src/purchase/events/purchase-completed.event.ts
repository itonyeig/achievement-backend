import { Types } from 'mongoose';

export class PurchaseCompletedEvent {
  constructor(public readonly userId: string | Types.ObjectId) {}
}
