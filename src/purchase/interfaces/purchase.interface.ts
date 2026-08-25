import { Types } from 'mongoose';

export interface PurchaseResponse {
  _id: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  productId: string | Types.ObjectId;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}
