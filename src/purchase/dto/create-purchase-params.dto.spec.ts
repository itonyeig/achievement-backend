import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePurchaseParamsDto } from './create-purchase-params.dto';

describe('CreatePurchaseParamsDto', () => {
  const validParams = {
    productId: '66c740862c2cb219f9b9ef11',
    userId: '66c740862c2cb219f9b9ef12',
  };

  it('accepts valid MongoDB product and user IDs', async () => {
    await expectValidationProperties(validParams, []);
  });

  it.each([
    ['a missing product ID', { productId: undefined }, ['productId']],
    ['an empty product ID', { productId: '' }, ['productId']],
    ['a malformed product ID', { productId: 'not-an-id' }, ['productId']],
    ['a non-string product ID', { productId: 123 }, ['productId']],
    ['a missing user ID', { userId: undefined }, ['userId']],
    ['an empty user ID', { userId: '' }, ['userId']],
    ['a malformed user ID', { userId: 'not-an-id' }, ['userId']],
    ['a non-string user ID', { userId: 123 }, ['userId']],
  ])('rejects %s', async (_scenario, override, properties) => {
    await expectValidationProperties(
      { ...validParams, ...override },
      properties,
    );
  });
});

async function expectValidationProperties(
  value: object,
  expectedProperties: string[],
): Promise<void> {
  const dto = plainToInstance(CreatePurchaseParamsDto, value);
  const errors = await validate(dto);
  const properties = errors.map((error) => error.property);

  if (expectedProperties.length === 0) {
    expect(properties).toEqual([]);
    return;
  }

  expect(properties).toEqual(expect.arrayContaining(expectedProperties));
}
