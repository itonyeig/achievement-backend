import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from 'mongoose';
import { Product } from '../../product/schema/product.schema';
import { User } from '../../user/schema/user.schema';

export type PurchaseDocument = HydratedDocument<Purchase>;

@Schema({ timestamps: true })
export class Purchase {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: true,
  })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  createdAt: Date;

  updatedAt: Date;
}

export const PurchaseSchema = SchemaFactory.createForClass(Purchase);
