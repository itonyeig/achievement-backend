import type { Types } from 'mongoose';

export type PurchaseCompletedEvent = Readonly<{
  userId: string | Types.ObjectId;
}>;
