import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { API_PREFIX } from './common/constants/app.constants';
import { configureApplication } from './config/application.config';
import { configureSwagger } from './config/swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService: ConfigService = app.get<ConfigService>(ConfigService);
  const port: number = configService.get<number>('PORT', 4000);

  app.setGlobalPrefix(API_PREFIX);
  configureSwagger(app, configService);
  configureApplication(app, configService);

  await app.listen(port);
}

void bootstrap();
