import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  const validUser = {
    name: 'Jane Doe',
    email: 'jane@example.com',
  };

  it('accepts valid user details', async () => {
    await expectValidationProperties(validUser, []);
  });

  it.each([
    ['missing name', { name: undefined }, ['name']],
    ['empty name', { name: '' }, ['name']],
    ['non-string name', { name: 123 }, ['name']],
    ['name over 100 characters', { name: 'a'.repeat(101) }, ['name']],
    ['missing email', { email: undefined }, ['email']],
    ['invalid email', { email: 'invalid-email' }, ['email']],
    ['non-string email', { email: 123 }, ['email']],
    [
      'email over 254 characters',
      { email: `${'a'.repeat(250)}@x.com` },
      ['email'],
    ],
  ])('rejects %s', async (_scenario, overrides, properties) => {
    await expectValidationProperties(
      { ...validUser, ...overrides },
      properties,
    );
  });
});

async function expectValidationProperties(
  value: object,
  expectedProperties: string[],
): Promise<void> {
  const dto = plainToInstance(CreateUserDto, value);
  const errors = await validate(dto);
  const properties = errors.map((error) => error.property);

  if (expectedProperties.length === 0) {
    expect(properties).toEqual([]);
    return;
  }

  expect(properties).toEqual(expect.arrayContaining(expectedProperties));
}
