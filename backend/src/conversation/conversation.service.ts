import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service.js';
import type { AiMessage, AiProviderName } from '../ai/ai.types.js';
import { ConversationMessage } from './entities/conversation-message.entity.js';
import { Conversation } from './entities/conversation.entity.js';
import type {
  ConversationDetail,
  ConversationMessageView,
  ConversationSummary,
  CreateInitialConversationInput,
} from './conversation.types.js';

function lastAssistantPreview(
  messages: ConversationMessage[] | undefined,
): string | null {
  const last = [...(messages ?? [])]
    .sort((left, right) => left.sequence - right.sequence)
    .findLast((message) => message.role === 'assistant');
  return last?.content ?? null;
}

function toMessageView(message: ConversationMessage): ConversationMessageView {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

function sortedMessages(
  messages: ConversationMessage[] | undefined,
): ConversationMessage[] {
  return [...(messages ?? [])].sort(
    (left, right) => left.sequence - right.sequence,
  );
}

function toSummary(conversation: Conversation): ConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    model: conversation.model,
    provider: conversation.provider,
    jobId: conversation.jobId,
    preview: lastAssistantPreview(conversation.messages),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function toDetail(conversation: Conversation): ConversationDetail {
  return {
    ...toSummary(conversation),
    messages: sortedMessages(conversation.messages).map(toMessageView),
  };
}

function toAiMessages(messages: ConversationMessage[]): AiMessage[] {
  return sortedMessages(messages).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(ConversationMessage)
    private readonly messages: Repository<ConversationMessage>,
    private readonly ai: AiService,
  ) {}

  async findByJobId(jobId: string): Promise<Conversation | null> {
    return this.conversations.findOne({
      where: { jobId },
      relations: { messages: true },
    });
  }

  completedJobResult(
    conversation: Conversation,
  ): { conversationId: string; text: string } {
    return {
      conversationId: conversation.id,
      text: lastAssistantPreview(conversation.messages) ?? '',
    };
  }

  async createInitial(
    input: CreateInitialConversationInput,
  ): Promise<Conversation> {
    const conversation = this.conversations.create({
      jobId: input.jobId,
      userId: input.userId,
      title: input.title,
      provider: input.provider,
      model: input.model,
      messages: [
        this.messages.create({
          role: 'system',
          content: input.systemContent,
          sequence: 0,
        }),
        this.messages.create({
          role: 'user',
          content: input.userContent,
          sequence: 1,
        }),
        this.messages.create({
          role: 'assistant',
          content: input.assistantContent,
          sequence: 2,
        }),
      ],
    });
    return this.conversations.save(conversation);
  }

  async listForUser(userId: string): Promise<ConversationSummary[]> {
    const conversations = await this.conversations.find({
      where: { userId },
      relations: { messages: true },
      order: { updatedAt: 'DESC' },
    });
    return conversations.map(toSummary);
  }

  async getForUser(id: string, userId: string): Promise<ConversationDetail> {
    return toDetail(await this.requireForUser(id, userId));
  }

  async addUserMessage(
    id: string,
    userId: string,
    content: string,
  ): Promise<ConversationDetail> {
    const conversation = await this.requireForUser(id, userId);
    const history = sortedMessages(conversation.messages);
    const nextSequence = (history.at(-1)?.sequence ?? -1) + 1;
    const result = await this.ai.generateText({
      provider: conversation.provider as AiProviderName,
      model: conversation.model,
      messages: [...toAiMessages(history), { role: 'user', content }],
    });

    const [userMessage, assistantMessage] = await this.messages.save([
      this.messages.create({
        conversationId: conversation.id,
        role: 'user',
        content,
        sequence: nextSequence,
      }),
      this.messages.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: result.text,
        sequence: nextSequence + 1,
      }),
    ]);
    conversation.updatedAt = new Date();
    await this.conversations.update(conversation.id, {
      updatedAt: conversation.updatedAt,
    });
    conversation.messages = [...history, userMessage, assistantMessage];
    return toDetail(conversation);
  }

  private async requireForUser(
    id: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversations.findOne({
      where: { id, userId },
      relations: { messages: true },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }
}
