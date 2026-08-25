import {
  deleteModel,
  Error as MongooseError,
  model,
  Types,
  type Model,
} from 'mongoose';
import { Product } from '../../product/schema/product.schema';
import { User } from '../../user/schema/user.schema';
import { Purchase, PurchaseSchema } from './purchase.schema';

describe('PurchaseSchema', () => {
  let purchaseModel: Model<Purchase>;
  const validPurchase = {
    userId: new Types.ObjectId(),
    productId: new Types.ObjectId(),
    totalAmount: 12000,
  };

  beforeAll(() => {
    purchaseModel = model<Purchase>('PurchaseSchemaTest', PurchaseSchema);
  });

  afterAll(() => {
    deleteModel('PurchaseSchemaTest');
  });

  it('accepts a complete purchase record', async () => {
    const purchase = new purchaseModel(validPurchase);

    await expect(purchase.validate()).resolves.toBeUndefined();
  });

  it.each([
    ['userId', { userId: undefined }],
    ['productId', { productId: undefined }],
    ['totalAmount', { totalAmount: undefined }],
  ])('requires %s', async (property, override) => {
    const purchase = new purchaseModel({ ...validPurchase, ...override });

    const error = await purchase
      .validate()
      .catch((validationError: unknown) => validationError);

    expect(error).toBeInstanceOf(MongooseError.ValidationError);
    expect((error as MongooseError.ValidationError).errors).toHaveProperty(
      property,
    );
  });

  it('rejects a negative total amount', async () => {
    const purchase = new purchaseModel({
      ...validPurchase,
      totalAmount: -1,
    });

    const error = await purchase
      .validate()
      .catch((validationError: unknown) => validationError);

    expect(error).toBeInstanceOf(MongooseError.ValidationError);
    expect((error as MongooseError.ValidationError).errors).toHaveProperty(
      'totalAmount',
    );
  });

  it('accepts a zero total amount', async () => {
    const purchase = new purchaseModel({
      ...validPurchase,
      totalAmount: 0,
    });

    await expect(purchase.validate()).resolves.toBeUndefined();
  });

  it('references the User and Product models', () => {
    expect(PurchaseSchema.path('userId').instance).toBe('ObjectId');
    expect(PurchaseSchema.path('productId').instance).toBe('ObjectId');
    expect(PurchaseSchema.path('userId').options).toEqual(
      expect.objectContaining({
        required: true,
        ref: User.name,
        index: true,
      }),
    );
    expect(PurchaseSchema.path('productId').options).toEqual(
      expect.objectContaining({
        required: true,
        ref: Product.name,
      }),
    );
  });

  it('configures automatic timestamps', () => {
    expect(PurchaseSchema.options.timestamps).toBe(true);
  });
});
