import { Module } from '@nestjs/common';
import { ConsumerService } from './consumer.service.js';
import { ConsumerController } from './consumer.controller.js';
import { BullModule } from '@nestjs/bullmq';
import { ConsumerProcessor } from './consumer.processor.js';

@Module({
  imports: [BullModule.registerQueue({
    name: 'jobs',
  })],
  // controllers: [ConsumerController],
  providers: [ConsumerService, ConsumerProcessor],
})
export class ConsumerModule {}
