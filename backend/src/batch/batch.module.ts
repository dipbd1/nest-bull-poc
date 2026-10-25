import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { Conversation } from '../conversation/entities/conversation.entity.js';
import { QueueModule } from '../queue/queue.module.js';
import { BatchController } from './batch.controller.js';
import { BatchService } from './batch.service.js';
import { FeedbackBatch } from './entities/feedback-batch.entity.js';
import { FeedbackItem } from './entities/feedback-item.entity.js';
import { FeedbackCodingService } from './feedback-coding.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeedbackBatch, FeedbackItem, Conversation]),
    AuthModule,
    QueueModule,
    ConversationModule,
  ],
  controllers: [BatchController],
  providers: [BatchService, FeedbackCodingService],
  exports: [BatchService, FeedbackCodingService],
})
export class BatchModule {}
