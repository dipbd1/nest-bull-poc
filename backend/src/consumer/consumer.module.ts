import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BatchModule } from '../batch/batch.module.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { ConsumerController } from './consumer.controller.js';
import { ConsumerProcessor } from './consumer.processor.js';
import { ConsumerService } from './consumer.service.js';

@Module({
  imports: [QueueModule, AuthModule, ConversationModule, BatchModule],
  controllers: [ConsumerController],
  providers: [ConsumerService, ConsumerProcessor],
  exports: [ConsumerProcessor],
})
export class ConsumerModule {}
