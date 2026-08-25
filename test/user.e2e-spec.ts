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
});
