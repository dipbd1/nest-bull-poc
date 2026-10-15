import { Module } from '@nestjs/common';
import { ConsumerService } from './consumer.service.js';
import { ConsumerProcessor } from './consumer.processor.js';
import { QueueModule } from '../queue/queue.module.js';

@Module({
  imports: [QueueModule],
  providers: [ConsumerService, ConsumerProcessor],
})
export class ConsumerModule {}
