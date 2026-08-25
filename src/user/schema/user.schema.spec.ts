import {
  deleteModel,
  Error as MongooseError,
  model,
  type Model,
} from 'mongoose';
import { User, UserSchema } from './user.schema';

describe('UserSchema', () => {
  let userModel: Model<User>;

  beforeAll(() => {
    userModel = model<User>('UserSchemaTest', UserSchema);
  });

  afterAll(() => {
    deleteModel('UserSchemaTest');
  });

  it('accepts the complete minimal payout record', async () => {
    const user = new userModel({
      name: 'Jane Doe',
      email: 'jane@example.com',
      accountNumber: '9079325911',
      accountName: 'Jane Doe',
      bankCode: '058',
      recipientCode: 'RCP_example',
    });

    await expect(user.validate()).resolves.toBeUndefined();
  });

  it('lowercases and trims email addresses', () => {
    const user = new userModel({ email: '  JANE@EXAMPLE.COM  ' });

    expect(user.email).toBe('jane@example.com');
  });

  it('declares email as required and unique', () => {
    expect(UserSchema.path('email').options).toEqual(
      expect.objectContaining({
        required: true,
        unique: true,
        lowercase: true,
      }),
    );
    expect(UserSchema.indexes()).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          { email: 1 },
          expect.objectContaining({ unique: true }),
        ]),
      ]),
    );
  });

  it('excludes recipient codes from queries by default', () => {
    expect(UserSchema.path('recipientCode').options).toEqual(
      expect.objectContaining({
        required: true,
        select: false,
      }),
    );
  });

  it.each([
    ['name', { name: undefined }],
    ['email', { email: undefined }],
    ['accountNumber', { accountNumber: undefined }],
    ['accountName', { accountName: undefined }],
    ['bankCode', { bankCode: undefined }],
    ['recipientCode', { recipientCode: undefined }],
  ])('requires %s', async (property, override) => {
    const user = new userModel({
      name: 'Jane Doe',
      email: 'jane@example.com',
      accountNumber: '9079325911',
      accountName: 'Jane Doe',
      bankCode: '058',
      recipientCode: 'RCP_example',
      ...override,
    });

    const error = await user
      .validate()
      .catch((validationError: unknown) => validationError);

    expect(error).toBeInstanceOf(MongooseError.ValidationError);
    expect((error as MongooseError.ValidationError).errors).toHaveProperty(
      property,
    );
  });

  it.each([
    ['accountNumber', { accountNumber: '1234' }],
    ['bankCode', { bankCode: 'bank' }],
  ])('rejects an invalid %s', async (property, override) => {
    const user = new userModel({
      name: 'Jane Doe',
      email: 'jane@example.com',
      accountNumber: '9079325911',
      accountName: 'Jane Doe',
      bankCode: '058',
      recipientCode: 'RCP_example',
      ...override,
    });

    const error = await user
      .validate()
      .catch((validationError: unknown) => validationError);

    expect(error).toBeInstanceOf(MongooseError.ValidationError);
    expect((error as MongooseError.ValidationError).errors).toHaveProperty(
      property,
    );
  });
});
