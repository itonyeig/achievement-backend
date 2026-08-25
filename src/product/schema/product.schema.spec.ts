import {
  deleteModel,
  Error as MongooseError,
  model,
  type Model,
} from 'mongoose';
import { Product, ProductSchema } from './product.schema';

describe('ProductSchema', () => {
  let productModel: Model<Product>;

  beforeAll(() => {
    productModel = model<Product>('ProductSchemaTest', ProductSchema);
  });

  afterAll(() => {
    deleteModel('ProductSchemaTest');
  });

  it('accepts a valid product', async () => {
    const product = new productModel({
      name: 'Wireless Mouse',
      price: 12000,
    });

    await expect(product.validate()).resolves.toBeUndefined();
  });

  it('trims product names', () => {
    const product = new productModel({
      name: '  Wireless Mouse  ',
      price: 12000,
    });

    expect(product.name).toBe('Wireless Mouse');
  });

  it.each([
    ['name', { name: undefined }],
    ['price', { price: undefined }],
  ])('requires %s', async (property, override) => {
    const product = new productModel({
      name: 'Wireless Mouse',
      price: 12000,
      ...override,
    });

    const error = await product
      .validate()
      .catch((validationError: unknown) => validationError);

    expect(error).toBeInstanceOf(MongooseError.ValidationError);
    expect((error as MongooseError.ValidationError).errors).toHaveProperty(
      property,
    );
  });

  it('rejects a blank product name after trimming', async () => {
    const product = new productModel({ name: '   ', price: 12000 });

    const error = await product
      .validate()
      .catch((validationError: unknown) => validationError);

    expect(error).toBeInstanceOf(MongooseError.ValidationError);
    expect((error as MongooseError.ValidationError).errors).toHaveProperty(
      'name',
    );
  });

  it('rejects negative prices', async () => {
    const product = new productModel({ name: 'Wireless Mouse', price: -1 });

    const error = await product
      .validate()
      .catch((validationError: unknown) => validationError);

    expect(error).toBeInstanceOf(MongooseError.ValidationError);
    expect((error as MongooseError.ValidationError).errors).toHaveProperty(
      'price',
    );
  });

  it('accepts a zero price', async () => {
    const product = new productModel({ name: 'Free Sample', price: 0 });

    await expect(product.validate()).resolves.toBeUndefined();
  });

  it('configures automatic timestamps', () => {
    expect(ProductSchema.options.timestamps).toBe(true);
  });
});
