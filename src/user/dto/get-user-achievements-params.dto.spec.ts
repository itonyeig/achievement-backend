import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetUserAchievementsParamsDto } from './get-user-achievements-params.dto';

describe('GetUserAchievementsParamsDto', () => {
  it('accepts a valid MongoDB user ID', async () => {
    const dto = plainToInstance(GetUserAchievementsParamsDto, {
      user: '66c740862c2cb219f9b9ef11',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['malformed', 'not-a-mongo-id'],
    ['non-string', 123],
  ])('rejects a %s user ID', async (_scenario, user) => {
    const dto = plainToInstance(GetUserAchievementsParamsDto, { user });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('user');
  });
});
