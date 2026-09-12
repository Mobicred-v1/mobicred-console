import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix(config.get<string>('app.apiPrefix') ?? 'api/v1');
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const origins = config.get<string[]>('cors.origins') ?? [];
  app.enableCors({ origin: origins.length ? origins : false, credentials: true });
  if (process.env.CONSOLE_SWAGGER_ENABLED === 'true' && process.env.NODE_ENV !== 'production') {
    const swagger = new DocumentBuilder().setTitle('MobiCred Console API').setDescription('Scoped staff BFF. Does not own money, scores or banking records.').setVersion('0.2.0').addBearerAuth().build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  }
  app.enableShutdownHooks();
  await app.listen(config.get<number>('app.port') ?? 3005);
}
void bootstrap();
