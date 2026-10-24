import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { ConversationController } from './conversation.controller.js';
import { ConversationService } from './conversation.service.js';
import { ConversationMessage } from './entities/conversation-message.entity.js';
import { Conversation } from './entities/conversation.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ConversationMessage]),
    AuthModule,
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
