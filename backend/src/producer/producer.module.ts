import { Module } from '@nestjs/common';
import { ProducerService } from './producer.service.js';
import { ProducerController } from './producer.controller.js';
import { QueueModule } from '../queue/queue.module.js';

@Module({
  imports: [QueueModule],
  controllers: [ProducerController],
  providers: [ProducerService],
})
export class ProducerModule {}
