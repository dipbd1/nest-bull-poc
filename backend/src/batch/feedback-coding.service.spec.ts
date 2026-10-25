import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { APICallError, NoOutputGeneratedError } from 'ai';
import { UnrecoverableError } from 'bullmq';
import { AiRequestError } from '../ai/ai.errors.js';
import { AiService } from '../ai/ai.service.js';
import { OpenRouterCatalogService } from '../ai/openrouter-catalog.service.js';
import { ConversationService } from '../conversation/conversation.service.js';
import type { FeedbackBatch } from './entities/feedback-batch.entity.js';
import { FeedbackItem } from './entities/feedback-item.entity.js';
import {
  codingSystemPrompt,
  feedbackCodeSchema,
  FeedbackCodingService,
} from './feedback-coding.service.js';

const TAGS = ['Pricing', 'Bug', 'Praise'];

function makeItem(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: 'item-1',
    batchId: 'batch-1',
    position: 3,
    text: 'The export button crashes the page',
    suggestedTag: null,
    summary: null,
    finalTag: null,
    status: 'queued',
    jobId: '11',
    conversationId: null,
    failedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    batch: {
      id: 'batch-1',
      title: 'Q3 survey',
      model: 'gpt-4o-mini',
      tags: TAGS,
      createdById: 'user-1',
    } as FeedbackBatch,
    ...overrides,
  };
}

function makeJob(attemptsMade = 0) {
  return { id: '11', attemptsMade, opts: { attempts: 3 } };
}

function rateLimitError(): AiRequestError {
  return new AiRequestError(
    'openrouter',
    'gpt-4o-mini',
    new APICallError({
      message: 'Too many requests',
      url: 'https://api.example.com/v1/messages',
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    }),
  );
}

describe('FeedbackCodingService', () => {
  let service: FeedbackCodingService;
  const items = { findOne: vi.fn(), update: vi.fn() };
  const ai = { generateObject: vi.fn() };
  const conversations = { findByJobId: vi.fn(), createInitial: vi.fn() };
  const catalog = { assertFreeModel: vi.fn() };

  beforeEach(async () => {
    items.findOne.mockReset().mockResolvedValue(makeItem());
    items.update.mockReset();
    ai.generateObject.mockReset();
    conversations.findByJobId.mockReset().mockResolvedValue(null);
    conversations.createInitial.mockReset().mockResolvedValue({ id: 'conv-1' });
    catalog.assertFreeModel.mockReset().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackCodingService,
        { provide: getRepositoryToken(FeedbackItem), useValue: items },
        { provide: AiService, useValue: ai },
        { provide: ConversationService, useValue: conversations },
        { provide: OpenRouterCatalogService, useValue: catalog },
      ],
    }).compile();

    service = module.get(FeedbackCodingService);
  });

  it('saves a tag from the batch list as coded, using OpenRouter', async () => {
    ai.generateObject.mockResolvedValue({
      provider: 'openrouter',
      model: 'gpt-4o-mini',
      object: { tag: 'bug', summary: 'Export crashes the page.' },
      usage: {},
    });

    await expect(service.codeItem(makeJob(), 'item-1')).resolves.toEqual({
      itemId: 'item-1',
      status: 'coded',
      conversationId: 'conv-1',
      skipped: false,
    });

    expect(ai.generateObject).toHaveBeenCalledWith({
      provider: 'openrouter',
      model: 'gpt-4o-mini',
      schema: feedbackCodeSchema,
      messages: [
        { role: 'system', content: codingSystemPrompt(TAGS) },
        { role: 'user', content: 'The export button crashes the page' },
      ],
    });
    expect(items.update).toHaveBeenCalledWith('item-1', {
      status: 'coded',
      suggestedTag: 'Bug',
      summary: 'Export crashes the page.',
      conversationId: 'conv-1',
      failedReason: null,
    });
    expect(conversations.createInitial).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: '11',
        userId: 'user-1',
        provider: 'openrouter',
        userContent: 'The export button crashes the page',
      }),
    );
  });

  it('saves an unknown tag as needs_review without throwing', async () => {
    ai.generateObject.mockResolvedValue({
      provider: 'openrouter',
      model: 'gpt-4o-mini',
      object: { tag: 'Shipping', summary: 'Something about delivery.' },
      usage: {},
    });

    await expect(service.codeItem(makeJob(), 'item-1')).resolves.toMatchObject({
      status: 'needs_review',
    });
    expect(items.update).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ status: 'needs_review', suggestedTag: null }),
    );
  });

  it('saves unusable model output as needs_review without throwing', async () => {
    ai.generateObject.mockRejectedValue(
      new AiRequestError(
        'openrouter',
        'gpt-4o-mini',
        new NoOutputGeneratedError({ message: 'No output generated' }),
      ),
    );

    await expect(service.codeItem(makeJob(), 'item-1')).resolves.toMatchObject({
      status: 'needs_review',
    });
    expect(items.update).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({
        status: 'needs_review',
        suggestedTag: null,
        summary: null,
      }),
    );
  });

  it('throws on a rate limit so BullMQ retries, and leaves the item queued', async () => {
    ai.generateObject.mockRejectedValue(rateLimitError());

    await expect(service.codeItem(makeJob(0), 'item-1')).rejects.toBeInstanceOf(
      AiRequestError,
    );
    expect(items.update).not.toHaveBeenCalled();
    expect(conversations.createInitial).not.toHaveBeenCalled();
  });

  it('marks the item failed when the last attempt throws', async () => {
    ai.generateObject.mockRejectedValue(rateLimitError());

    await expect(service.codeItem(makeJob(2), 'item-1')).rejects.toBeInstanceOf(
      AiRequestError,
    );
    expect(items.update).toHaveBeenCalledWith('item-1', {
      status: 'failed',
      failedReason: 'AI request to openrouter (gpt-4o-mini) failed',
    });
  });

  it('skips the model when the item is already coded', async () => {
    items.findOne.mockResolvedValue(
      makeItem({ status: 'coded', conversationId: 'conv-1' }),
    );

    await expect(service.codeItem(makeJob(), 'item-1')).resolves.toEqual({
      itemId: 'item-1',
      status: 'coded',
      conversationId: 'conv-1',
      skipped: true,
    });
    expect(ai.generateObject).not.toHaveBeenCalled();
  });

  it('fails without retry when the batch model is no longer free', async () => {
    catalog.assertFreeModel.mockRejectedValue(
      new BadRequestException('Choose a free OpenRouter model'),
    );

    await expect(service.codeItem(makeJob(), 'item-1')).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(ai.generateObject).not.toHaveBeenCalled();
    expect(items.update).toHaveBeenCalledWith('item-1', {
      status: 'failed',
      failedReason: 'Choose a free OpenRouter model',
    });
  });
});
