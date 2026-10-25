import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import {
  assertProductionEnv,
  resolveWebOrigin,
} from './config/app.config.js';
import { originCheck } from './security/origin.js';

async function bootstrap() {
  assertProductionEnv(process.env);
  const webOrigin = resolveWebOrigin(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '512kb' });
  app.use(originCheck(webOrigin));
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
