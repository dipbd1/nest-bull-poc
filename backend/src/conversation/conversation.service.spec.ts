import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiService } from '../ai/ai.service.js';
import { FeedbackItem } from '../batch/entities/feedback-item.entity.js';
import { ConversationService } from './conversation.service.js';
import { ConversationMessage } from './entities/conversation-message.entity.js';
import { Conversation } from './entities/conversation.entity.js';

function makeMessage(
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'hello',
    sequence: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    conversation: undefined as unknown as Conversation,
    ...overrides,
  };
}

function makeConversation(
  overrides: Partial<Conversation> = {},
): Conversation {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'conv-1',
    userId: 'user-1',
    jobId: '42',
    title: 'alpha',
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini',
    createdAt,
    updatedAt: createdAt,
    messages: [
      makeMessage({
        id: 'sys',
        role: 'system',
        content: 'system',
        sequence: 0,
      }),
      makeMessage({
        id: 'user',
        role: 'user',
        content: 'Job name: alpha\n\nsummarize this',
        sequence: 1,
      }),
      makeMessage({
        id: 'asst',
        role: 'assistant',
        content: 'first reply',
        sequence: 2,
      }),
    ],
    ...overrides,
  };
}

describe('ConversationService', () => {
  let service: ConversationService;
  const conversations = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
  };
  const messages = {
    create: vi.fn((value: Partial<ConversationMessage>) => value),
    save: vi.fn(),
  };
  const ai = { generateText: vi.fn() };
  const items = { exists: vi.fn() };

  beforeEach(async () => {
    items.exists.mockReset().mockResolvedValue(false);
    conversations.find.mockReset();
    conversations.findOne.mockReset();
    conversations.create.mockReset();
    conversations.save.mockReset();
    conversations.update.mockReset();
    messages.create.mockReset().mockImplementation((value) => value);
    messages.save.mockReset();
    ai.generateText.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: getRepositoryToken(Conversation), useValue: conversations },
        {
          provide: getRepositoryToken(ConversationMessage),
          useValue: messages,
        },
        { provide: getRepositoryToken(FeedbackItem), useValue: items },
        { provide: AiService, useValue: ai },
      ],
    }).compile();

    service = module.get(ConversationService);
  });

  it('lists the caller conversations with the latest assistant preview', async () => {
    conversations.find.mockResolvedValue([makeConversation()]);
    await expect(service.listForUser('user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'conv-1',
        title: 'alpha',
        model: 'openai/gpt-4o-mini',
        preview: 'first reply',
      }),
    ]);
  });

  it('returns 404 for another user conversation', async () => {
    conversations.findOne.mockResolvedValue(null);
    await expect(service.getForUser('conv-1', 'user-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets any user open a conversation linked to a feedback item', async () => {
    const conversation = makeConversation();
    conversations.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(conversation);
    items.exists.mockResolvedValue(true);

    await expect(service.getForUser('conv-1', 'user-2')).resolves.toEqual(
      expect.objectContaining({ id: 'conv-1' }),
    );
    expect(items.exists).toHaveBeenCalledWith({
      where: { conversationId: 'conv-1' },
    });
  });

  it('replays history and saves both new messages after a follow-up', async () => {
    const conversation = makeConversation();
    conversations.findOne.mockResolvedValue(conversation);
    ai.generateText.mockResolvedValue({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      text: 'second reply',
      usage: {},
    });
    messages.save.mockImplementation(async (rows: ConversationMessage[]) =>
      rows.map((row, index) =>
        Object.assign(row, {
          id: `new-${index}`,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        }),
      ),
    );
    conversations.update.mockResolvedValue(undefined);

    const detail = await service.addUserMessage(
      'conv-1',
      'user-1',
      'tell me more',
    );

    expect(ai.generateText).toHaveBeenCalledWith({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'Job name: alpha\n\nsummarize this' },
        { role: 'assistant', content: 'first reply' },
        { role: 'user', content: 'tell me more' },
      ],
    });
    expect(messages.save).toHaveBeenCalledWith([
      expect.objectContaining({
        conversationId: 'conv-1',
        role: 'user',
        content: 'tell me more',
        sequence: 3,
      }),
      expect.objectContaining({
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'second reply',
        sequence: 4,
      }),
    ]);
    expect(detail.messages.map((message) => message.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(detail.preview).toBe('second reply');
  });

  it('leaves the transcript unchanged when the follow-up model call fails', async () => {
    conversations.findOne.mockResolvedValue(makeConversation());
    ai.generateText.mockRejectedValue(new Error('OpenRouter down'));

    await expect(
      service.addUserMessage('conv-1', 'user-1', 'tell me more'),
    ).rejects.toThrow('OpenRouter down');
    expect(messages.save).not.toHaveBeenCalled();
    expect(conversations.update).not.toHaveBeenCalled();
  });
});
