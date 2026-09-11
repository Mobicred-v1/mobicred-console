import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const prefix = config.get<string>('app.apiPrefix') ?? 'api/v1';
  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const origins = config.get<string[]>('cors.origins') ?? [];
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle('MobiCred Console API')
    .setDescription(
      'Staff BFF. Composes owner services. Does not own money, scores, or Fineract records.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  await app.listen(config.get<number>('app.port') ?? 3005);
}
void bootstrap();
