import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { jobQueueName } from '../config/queue.config.js';
import { QueueController } from './queue.controller.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const username = configService.get<string>('queue.redis.username');
        const password = configService.get<string>('queue.redis.password');
        const useTls = configService.get<boolean>('queue.redis.tls');

        return {
          connection: {
            host: configService.get<string>('queue.redis.host'),
            port: configService.get<number>('queue.redis.port'),
            ...(username ? { username } : {}),
            ...(password ? { password } : {}),
            ...(useTls ? { tls: {} } : {}),
          },
        };
      },
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
