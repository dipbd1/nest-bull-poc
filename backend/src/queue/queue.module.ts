import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { jobQueueName } from '../config/queue.config.js';
import { QueueController } from './queue.controller.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('queue.redis.host'),
          port: configService.get<number>('queue.redis.port'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: jobQueueName,
    }),
  ],
  controllers: [QueueController],
  exports: [BullModule],
})
export class QueueModule {}
