import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProducerModule } from './producer/producer.module.js';

import { ConfigModule } from '@nestjs/config';
import { ConsumerModule } from './consumer/consumer.module.js';
import { queueConfig, validateEnv } from './config/queue.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [queueConfig],
      validate: validateEnv,
    }),
    ProducerModule,
    ConsumerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
