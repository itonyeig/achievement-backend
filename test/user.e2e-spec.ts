import {
  BadGatewayException,
  HttpException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { API_PREFIX } from '../src/common/constants/app.constants';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseFormatterInterceptor } from '../src/common/interceptors/response-formatter.interceptor';
import { UserController } from '../src/user/user.controller';
import { UserService } from '../src/user/user.service';

describe('UserController (e2e)', () => {
  let app: INestApplication<App>;
  const userService = {
    createUser: jest.fn(),
    getAchievements: jest.fn(),
  };
  const validCreateUserBody = {
    name: 'Jane Doe',
    email: 'jane@example.com',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: userService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseFormatterInterceptor());
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/user creates a user without exposing the recipient code', async () => {
    const user = {
      _id: '66c740862c2cb219f9b9ef11',
      name: 'Jane Doe',
      email: 'jane@example.com',
      accountNumber: '0000000000',
      accountName: 'Jane Doe',
      bankCode: '057',
    };
    userService.createUser.mockResolvedValue(user);

    await request(app.getHttpServer())
      .post('/api/v1/user')
      .send(validCreateUserBody)
      .expect(201)
      .expect({
        success: true,
        statusCode: 201,
        message: 'Request was successful',
        data: user,
      });
  });

  it.each([
    ['a missing name', { name: undefined }],
    ['an empty name', { name: '' }],
    ['a non-string name', { name: 123 }],
    ['a name over 100 characters', { name: 'a'.repeat(101) }],
    ['a missing email', { email: undefined }],
    ['an invalid email', { email: 'invalid-email' }],
    ['a non-string email', { email: 123 }],
    ['an email over 254 characters', { email: `${'a'.repeat(250)}@x.com` }],
    ['an unexpected account number', { accountNumber: '0000000000' }],
    ['an unexpected bank code', { bankCode: '057' }],
    ['an unexpected account name', { accountName: 'Fake Name' }],
    ['an unexpected recipient code', { recipientCode: 'RCP_fake' }],
  ])('rejects %s', async (_scenario, override) => {
    await request(app.getHttpServer())
      .post('/api/v1/user')
      .send({ ...validCreateUserBody, ...override })
      .expect(400)
      .expect((response: request.Response) => {
        expect(response.body).toEqual(
          expect.objectContaining({ success: false, statusCode: 400 }),
        );
      });

    expect(userService.createUser).not.toHaveBeenCalled();
  });

  it('preserves Paystack client errors', async () => {
    userService.createUser.mockRejectedValue(
      new HttpException('Cannot resolve account', 400),
    );

    await request(app.getHttpServer())
      .post('/api/v1/user')
      .send(validCreateUserBody)
      .expect(400)
      .expect({
        success: false,
        statusCode: 400,
        error: 'HttpException',
        message: 'Cannot resolve account',
      });
  });

  it('formats Paystack availability failures', async () => {
    userService.createUser.mockRejectedValue(
      new BadGatewayException('Failed to create transfer recipient'),
    );

    await request(app.getHttpServer())
      .post('/api/v1/user')
      .send(validCreateUserBody)
      .expect(502)
      .expect({
        success: false,
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Failed to create transfer recipient',
      });
  });

  it('formats duplicate-email errors as conflicts', async () => {
    userService.createUser.mockRejectedValue(
      Object.assign(new Error('Duplicate email'), { code: 11000 }),
    );

    await request(app.getHttpServer())
      .post('/api/v1/user')
      .send(validCreateUserBody)
      .expect(409)
      .expect({
        success: false,
        statusCode: 409,
        error: 'Conflict',
        message: 'A record with the same unique value already exists',
      });
  });

  it('does not expose the removed bank-list endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/user/banks').expect(404);
  });

  it('does not expose the removed account-resolution endpoint', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/user/bank-account/resolve')
      .send({ accountNumber: '0000000000', bankCode: '057' })
      .expect(404);
  });

  describe('GET /api/v1/users/:user/achievements', () => {
    const userId = '66c740862c2cb219f9b9ef11';

    it('returns progress when no achievements have been unlocked', async () => {
      const progress = {
        unlocked_achievements: [],
        next_available_achievements: ['First Purchase'],
        current_badge: null,
        next_badge: 'Advanced',
        remaining_to_unlock_next_badge: 8,
      };
      userService.getAchievements.mockResolvedValue(progress);

      await request(app.getHttpServer())
        .get(`/api/v1/users/${userId}/achievements`)
        .expect(200)
        .expect({
          success: true,
          statusCode: 200,
          message: 'Request was successful',
          data: progress,
        });

      expect(userService.getAchievements).toHaveBeenCalledWith(userId);
    });

    it('returns the next achievement and remaining badge progress', async () => {
      const progress = {
        unlocked_achievements: [
          'First Purchase',
          '5 Purchases',
          '10 Purchases',
          '15 Purchases',
          '20 Purchases',
        ],
        next_available_achievements: ['25 Purchases'],
        current_badge: null,
        next_badge: 'Advanced',
        remaining_to_unlock_next_badge: 3,
      };
      userService.getAchievements.mockResolvedValue(progress);

      await request(app.getHttpServer())
        .get(`/api/v1/users/${userId}/achievements`)
        .expect(200)
        .expect({
          success: true,
          statusCode: 200,
          message: 'Request was successful',
          data: progress,
        });
    });

    it('returns Advanced as current after it is unlocked', async () => {
      const progress = {
        unlocked_achievements: [
          'First Purchase',
          '5 Purchases',
          '10 Purchases',
          '15 Purchases',
          '20 Purchases',
          '25 Purchases',
          '30 Purchases',
          '35 Purchases',
        ],
        next_available_achievements: [],
        current_badge: 'Advanced',
        next_badge: null,
        remaining_to_unlock_next_badge: 0,
      };
      userService.getAchievements.mockResolvedValue(progress);

      await request(app.getHttpServer())
        .get(`/api/v1/users/${userId}/achievements`)
        .expect(200)
        .expect({
          success: true,
          statusCode: 200,
          message: 'Request was successful',
          data: progress,
        });
    });

    it.each(['not-a-mongo-id', '123'])(
      'rejects the invalid user ID %s',
      async (id) => {
        await request(app.getHttpServer())
          .get(`/api/v1/users/${id}/achievements`)
          .expect(400)
          .expect((response: request.Response) => {
            expect(response.body).toEqual(
              expect.objectContaining({ success: false, statusCode: 400 }),
            );
          });

        expect(userService.getAchievements).not.toHaveBeenCalled();
      },
    );

    it('returns not found when the user does not exist', async () => {
      userService.getAchievements.mockRejectedValue(
        new HttpException('User not found', 404),
      );

      await request(app.getHttpServer())
        .get(`/api/v1/users/${userId}/achievements`)
        .expect(404)
        .expect({
          success: false,
          statusCode: 404,
          error: 'HttpException',
          message: 'User not found',
        });
    });

    it('formats progress-query failures as internal server errors', async () => {
      userService.getAchievements.mockRejectedValue(
        new Error('Failed to query progress'),
      );

      await request(app.getHttpServer())
        .get(`/api/v1/users/${userId}/achievements`)
        .expect(500)
        .expect({
          success: false,
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
        });
    });

    it('does not expose the progress endpoint under the singular user route', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/user/${userId}/achievements`)
        .expect(404);
    });
  });
});
