import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { ProducerController } from './producer.controller.js';
import { ProducerService } from './producer.service.js';

@Module({
  imports: [QueueModule, AuthModule],
  controllers: [ProducerController],
  providers: [ProducerService],
})
export class ProducerModule {}
