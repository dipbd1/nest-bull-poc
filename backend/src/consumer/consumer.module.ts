import { Module } from '@nestjs/common';
import { ConsumerController } from './consumer.controller.js';
import { ConsumerProcessor } from './consumer.processor.js';
import { ConsumerService } from './consumer.service.js';
import { QueueModule } from '../queue/queue.module.js';

@Module({
  imports: [QueueModule],
  controllers: [ConsumerController],
  providers: [ConsumerService, ConsumerProcessor],
  exports: [ConsumerProcessor],
})
export class ConsumerModule {}
