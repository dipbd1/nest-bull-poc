import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../ai/ai.service.js';
import { ConversationService } from '../conversation/conversation.service.js';
import type { Conversation } from '../conversation/entities/conversation.entity.js';
import type { ProducerJobData } from '../producer/producer.service.js';
import {
  ConsumerProcessor,
  JOB_SYSTEM_PROMPT,
  jobUserPrompt,
} from './consumer.processor.js';

function makeJob(overrides: Partial<ProducerJobData> = {}) {
  return {
    id: '42',
    data: {
      name: 'alpha',
      description: 'summarize this',
      model: 'vendor/free-model:free',
      userId: 'user-1',
      ...overrides,
    },
  };
}

describe('ConsumerProcessor', () => {
  let processor: ConsumerProcessor;
  const ai = { generateText: vi.fn() };
  const conversations = {
    findByJobId: vi.fn(),
    completedJobResult: vi.fn(),
    createInitial: vi.fn(),
  };

  beforeEach(async () => {
    ai.generateText.mockReset();
    conversations.findByJobId.mockReset();
    conversations.completedJobResult.mockReset();
    conversations.createInitial.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumerProcessor,
        { provide: AiService, useValue: ai },
        { provide: ConversationService, useValue: conversations },
      ],
    }).compile();

    processor = module.get(ConsumerProcessor);
  });

  it('calls OpenRouter with the job name and description, then stores the chat', async () => {
    conversations.findByJobId.mockResolvedValue(null);
    ai.generateText.mockResolvedValue({
      provider: 'openrouter',
      model: 'vendor/renamed-by-provider',
      text: 'first reply',
      usage: {},
    });
    conversations.createInitial.mockResolvedValue({ id: 'conv-1' });

    await expect(processor.process(makeJob() as never)).resolves.toEqual({
      conversationId: 'conv-1',
      text: 'first reply',
    });

    expect(ai.generateText).toHaveBeenCalledWith({
      provider: 'openrouter',
      model: 'vendor/free-model:free',
      messages: [
        { role: 'system', content: JOB_SYSTEM_PROMPT },
        {
          role: 'user',
          content: jobUserPrompt('alpha', 'summarize this'),
        },
      ],
    });
    expect(conversations.createInitial).toHaveBeenCalledWith({
      jobId: '42',
      userId: 'user-1',
      title: 'alpha',
      provider: 'openrouter',
      model: 'vendor/free-model:free',
      systemContent: JOB_SYSTEM_PROMPT,
      userContent: jobUserPrompt('alpha', 'summarize this'),
      assistantContent: 'first reply',
    });
  });

  it('skips the model when the job already has a conversation', async () => {
    const existing = { id: 'conv-1' } as Conversation;
    conversations.findByJobId.mockResolvedValue(existing);
    conversations.completedJobResult.mockReturnValue({
      conversationId: 'conv-1',
      text: 'cached reply',
    });

    await expect(processor.process(makeJob() as never)).resolves.toEqual({
      conversationId: 'conv-1',
      text: 'cached reply',
    });
    expect(conversations.completedJobResult).toHaveBeenCalledWith(existing);
    expect(ai.generateText).not.toHaveBeenCalled();
    expect(conversations.createInitial).not.toHaveBeenCalled();
  });

  it('does not store a chat when the model call fails', async () => {
    conversations.findByJobId.mockResolvedValue(null);
    ai.generateText.mockRejectedValue(new Error('OpenRouter down'));

    await expect(processor.process(makeJob() as never)).rejects.toThrow(
      'OpenRouter down',
    );
    expect(conversations.createInitial).not.toHaveBeenCalled();
  });
});
