import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { API_PREFIX } from './../src/common/constants/app.constants';
import { configureApplication } from './../src/config/application.config';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    configureApplication(app, app.get(ConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((response: request.Response) => {
        const body: unknown = response.body;

        expect(body).toEqual(
          expect.objectContaining({
            success: true,
            statusCode: 200,
            message: 'Request was successful',
            data: expect.objectContaining({
              status: 'ok',
              message: 'Service is healthy',
            }),
          }),
        );
      });
  });
});
