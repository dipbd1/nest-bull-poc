import { Module } from '@nestjs/common';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProducerModule } from './producer/producer.module.js';

import { ConfigModule } from '@nestjs/config';
import { ConsumerModule } from './consumer/consumer.module.js';
import { ConversationModule } from './conversation/conversation.module.js';
import { QueueModule } from './queue/queue.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuthModule } from './auth/auth.module.js';
import { aiConfig } from './config/ai.config.js';
import { authConfig } from './config/auth.config.js';
import { databaseConfig } from './config/database.config.js';
import { queueConfig, validateEnv } from './config/queue.config.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(dirname(fileURLToPath(import.meta.url)), '../.env'),
        resolve(dirname(fileURLToPath(import.meta.url)), '../../.env.local'),
      ],
      load: [queueConfig, aiConfig, databaseConfig, authConfig],
      validate: validateEnv,
    }),
    DatabaseModule,
    AiModule,
    AuthModule,
    ConversationModule,
    QueueModule,
    ProducerModule,
    ConsumerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
