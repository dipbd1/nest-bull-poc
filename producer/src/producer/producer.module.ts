import { Module } from '@nestjs/common';
import { ProducerService } from './producer.service.js';
import { ProducerController } from './producer.controller.js';

import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'jobs',
    }),
  ],
  controllers: [ProducerController],
  providers: [ProducerService],

})
export class ProducerModule {}
