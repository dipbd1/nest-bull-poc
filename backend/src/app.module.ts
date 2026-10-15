import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProducerModule } from './producer/producer.module.js';

import { ConfigModule } from '@nestjs/config';
import { ConsumerModule } from './consumer/consumer.module.js';

@Module({
  imports: [ProducerModule, ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '.env',
  }), ConsumerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
