export interface PurchaseResponse {
  id: string;
  userId: string;
  productId: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}
