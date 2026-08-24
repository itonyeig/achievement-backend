import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import { API_PREFIX } from '../common/constants/app.constants';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { ResponseFormatterInterceptor } from '../common/interceptors/response-formatter.interceptor';

export function configureApplication(
  app: INestApplication,
  configService: ConfigService,
): void {
  const nodeEnvironment = configService.getOrThrow<string>('NODE_ENV');

  app.use(helmet());
  app.use(compression());
  app.use(
    morgan('dev', {
      skip: (request: Request) =>
        request.originalUrl === `/${API_PREFIX}/health`,
    }),
  );
  app.enableCors({ origin: '*' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: nodeEnvironment !== 'production',
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseFormatterInterceptor());
}
