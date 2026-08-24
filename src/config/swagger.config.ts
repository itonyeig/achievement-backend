import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SWAGGER_PATH } from '../common/constants/app.constants';

export function configureSwagger(
  app: INestApplication,
  configService: ConfigService,
): void {
  if (configService.getOrThrow<string>('NODE_ENV') === 'production') {
    return;
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Achievements API')
    .setDescription('OpenAPI documentation for the Achievements backend')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      displayRequestDuration: true,
      filter: true,
      operationsSorter: 'alpha',
      tagsSorter: 'alpha',
    },
  });
}
