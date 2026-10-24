import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { ConversationService } from './conversation.service.js';
import { CreateConversationMessageDto } from './dto/create-conversation-message.dto.js';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationController {
  constructor(private readonly conversations: ConversationService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.conversations.listForUser(user.sub);
  }

  @Get(':id')
  get(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.conversations.getForUser(id, user.sub);
  }

  @Post(':id/messages')
  addMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateConversationMessageDto,
  ) {
    return this.conversations.addUserMessage(id, user.sub, dto.content);
  }
}
