import { getQueueToken } from '@nestjs/bullmq';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { OpenRouterCatalogService } from '../ai/openrouter-catalog.service.js';
import type { OpenRouterModelChoice } from '../ai/openrouter-catalog.js';
import { AuditService } from '../audit/audit.service.js';
import { jobQueueName } from '../config/queue.config.js';
import { Conversation } from '../conversation/entities/conversation.entity.js';
import { FEEDBACK_ITEM_JOB, FEEDBACK_ITEM_JOB_OPTIONS } from '../queue/job-data.js';
import { BatchService } from './batch.service.js';
import { FeedbackBatch } from './entities/feedback-batch.entity.js';
import { FeedbackItem } from './entities/feedback-item.entity.js';

const actor = { id: 'user-1', email: 'ada@example.com' };
const SECRET_COMMENT = 'My account number is 12345 and the app is slow';

function makeBatch(): FeedbackBatch {
  return {
    id: 'batch-1',
    title: 'Q3 survey',
    model: 'gpt-4o-mini',
    tags: ['Bug', 'Praise'],
    createdById: 'user-1',
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    items: [],
  };
}

function makeItem(overrides: Partial<FeedbackItem>): FeedbackItem {
  return {
    id: 'item-1',
    batchId: 'batch-1',
    position: 1,
    text: SECRET_COMMENT,
    suggestedTag: null,
    summary: null,
    finalTag: null,
    status: 'queued',
    jobId: null,
    conversationId: null,
    failedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    batch: undefined as unknown as FeedbackBatch,
    ...overrides,
  };
}

describe('BatchService', () => {
  let service: BatchService;
  const batches = {
    findOne: vi.fn(),
    find: vi.fn(),
    save: vi.fn(),
    create: vi.fn((value: Partial<FeedbackBatch>) => value),
    delete: vi.fn(),
  };
  const items = {
    find: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn((value: Partial<FeedbackItem>) => value),
  };
  const conversations = { delete: vi.fn() };
  const queue = { addBulk: vi.fn(), remove: vi.fn() };
  const catalog = { listFreeModels: vi.fn(), assertFreeModel: vi.fn() };
  let openRouterKey = 'sk-or';
  const config = {
    getOrThrow: vi.fn(() => ({
      providers: {
        openrouter: {
          apiKey: openRouterKey,
          model: 'openai/gpt-4o-mini',
          baseUrl: 'https://openrouter.ai/api/v1',
        },
      },
    })),
  };
  const audit = { record: vi.fn() };

  beforeEach(async () => {
    for (const mock of [
      batches.findOne,
      batches.find,
      batches.save,
      batches.delete,
      items.find,
      items.findOne,
      items.save,
      items.update,
      items.delete,
      conversations.delete,
      queue.addBulk,
      queue.remove,
      catalog.listFreeModels,
      catalog.assertFreeModel,
      audit.record,
    ]) {
      mock.mockReset();
    }
    openRouterKey = 'sk-or';
    catalog.listFreeModels.mockResolvedValue([]);
    catalog.assertFreeModel.mockResolvedValue(undefined);
    batches.findOne.mockResolvedValue(makeBatch());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchService,
        { provide: getRepositoryToken(FeedbackBatch), useValue: batches },
        { provide: getRepositoryToken(FeedbackItem), useValue: items },
        { provide: getRepositoryToken(Conversation), useValue: conversations },
        { provide: getQueueToken(jobQueueName), useValue: queue },
        { provide: OpenRouterCatalogService, useValue: catalog },
        { provide: ConfigService, useValue: config },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(BatchService);
  });

  it('records an export audit row with a count and no comment text', async () => {
    items.find.mockResolvedValue([
      makeItem({ status: 'coded', suggestedTag: 'Bug', finalTag: 'Bug' }),
    ]);

    const result = await service.exportCsv('batch-1', actor);

    expect(result.filename).toBe('q3-survey.csv');
    expect(result.csv).toContain(SECRET_COMMENT);
    expect(audit.record).toHaveBeenCalledWith({
      actor,
      action: 'batch.export',
      targetType: 'batch',
      targetId: 'batch-1',
      metadata: { rowCount: 1 },
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('12345');
  });

  it('creates items, enqueues one itemId job each, and audits without comment text', async () => {
    batches.save.mockImplementation(async (value: FeedbackBatch) => ({
      ...makeBatch(),
      ...value,
      id: 'batch-1',
    }));
    items.save.mockImplementation(async (rows: FeedbackItem[]) =>
      rows.map((row, index) => makeItem({ ...row, id: `item-${index + 1}` })),
    );
    queue.addBulk.mockResolvedValue([{ id: '1' }, { id: '2' }]);

    const detail = await service.create(
      {
        title: ' Q3 survey ',
        tags: ['Bug', 'Praise'],
        comments: [SECRET_COMMENT, 'Love it'],
        model: 'vendor/free-model:free',
      },
      actor,
    );

    expect(catalog.assertFreeModel).toHaveBeenCalledWith('vendor/free-model:free');
    expect(detail.items.map((item) => item.position)).toEqual([1, 2]);
    expect(detail.counts).toMatchObject({ total: 2, queued: 2 });
    expect(queue.addBulk).toHaveBeenCalledWith([
      { name: FEEDBACK_ITEM_JOB, data: { itemId: 'item-1' }, opts: FEEDBACK_ITEM_JOB_OPTIONS },
      { name: FEEDBACK_ITEM_JOB, data: { itemId: 'item-2' }, opts: FEEDBACK_ITEM_JOB_OPTIONS },
    ]);
    expect(items.update).toHaveBeenCalledWith('item-1', { jobId: '1' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'batch.create',
        metadata: { itemCount: 2, tags: ['Bug', 'Praise'], model: 'vendor/free-model:free' },
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('12345');
  });

  it('lists free models with a suggested default and whether the key is set', async () => {
    catalog.listFreeModels.mockResolvedValue([
      modelChoice({ id: 'text/low', name: 'Low', intelligenceIndex: 4 }),
      modelChoice({ id: 'text/high', name: 'High', intelligenceIndex: 20 }),
      modelChoice({
        id: 'audio/out',
        name: 'Audio',
        outputModalities: ['audio'],
        intelligenceIndex: 99,
      }),
    ]);

    await expect(service.models()).resolves.toMatchObject({
      defaultModel: 'text/high',
      ready: true,
    });
    const listed = await service.models();
    expect(listed.models.map((model) => model.id)).toEqual([
      'text/high',
      'text/low',
      'audio/out',
    ]);
  });

  it('rejects creation when OpenRouter is not connected', async () => {
    openRouterKey = '';

    await expect(
      service.create(
        { title: 't', tags: ['a', 'b'], comments: ['one'], model: 'text/high' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(catalog.assertFreeModel).not.toHaveBeenCalled();
    expect(batches.save).not.toHaveBeenCalled();
  });

  it('rejects a model that is not on the free list before saving anything', async () => {
    catalog.assertFreeModel.mockRejectedValue(
      new BadRequestException('Choose a free OpenRouter model'),
    );

    await expect(
      service.create(
        { title: 't', tags: ['a', 'b'], comments: ['one'], model: 'other' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(batches.save).not.toHaveBeenCalled();
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('retags to a batch tag and audits the change', async () => {
    items.findOne.mockResolvedValue(makeItem({ finalTag: 'Bug', position: 4 }));

    await expect(
      service.retag('batch-1', 'item-1', { finalTag: 'praise' }, actor),
    ).resolves.toMatchObject({ finalTag: 'Praise' });
    expect(items.update).toHaveBeenCalledWith('item-1', { finalTag: 'Praise' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'item.retag',
        metadata: { batchId: 'batch-1', position: 4, from: 'Bug', to: 'Praise' },
      }),
    );
  });

  it('refuses a tag outside the batch list', async () => {
    items.findOne.mockResolvedValue(makeItem({}));

    await expect(
      service.retag('batch-1', 'item-1', { finalTag: 'Shipping' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(items.update).not.toHaveBeenCalled();
  });

  it('clears the final tag when the choice is blank', async () => {
    items.findOne.mockResolvedValue(makeItem({ finalTag: 'Bug', position: 4 }));

    await expect(
      service.retag('batch-1', 'item-1', { finalTag: '  ' }, actor),
    ).resolves.toMatchObject({ finalTag: null });
    expect(items.update).toHaveBeenCalledWith('item-1', { finalTag: null });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'item.retag',
        metadata: { batchId: 'batch-1', position: 4, from: 'Bug', to: null },
      }),
    );
  });

  it('appends comments after the highest position and audits a count', async () => {
    items.find.mockResolvedValue([
      makeItem({ id: 'old', position: 1 }),
      makeItem({ id: 'gap', position: 3, text: 'kept' }),
    ]);
    items.save.mockImplementation(async (rows: FeedbackItem[]) =>
      rows.map((row, index) => makeItem({ ...row, id: `new-${index + 1}` })),
    );
    queue.addBulk.mockResolvedValue([{ id: '11' }, { id: '12' }]);

    const detail = await service.addComments(
      'batch-1',
      { comments: `${SECRET_COMMENT}\nSecond line` },
      actor,
    );

    expect(detail.items.map((item) => item.position)).toEqual([1, 3, 4, 5]);
    expect(queue.addBulk).toHaveBeenCalledWith([
      { name: FEEDBACK_ITEM_JOB, data: { itemId: 'new-1' }, opts: FEEDBACK_ITEM_JOB_OPTIONS },
      { name: FEEDBACK_ITEM_JOB, data: { itemId: 'new-2' }, opts: FEEDBACK_ITEM_JOB_OPTIONS },
    ]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'batch.add_comments',
        metadata: { added: 2, model: 'gpt-4o-mini' },
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('12345');
  });

  it('refuses comments that would pass the batch cap', async () => {
    items.find.mockResolvedValue(
      Array.from({ length: 99 }, (_, index) => makeItem({ id: `i-${index}`, position: index + 1 })),
    );

    await expect(
      service.addComments('batch-1', { comments: 'one\ntwo' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(items.save).not.toHaveBeenCalled();
  });

  it('drops the new rows when queueing them fails', async () => {
    items.find.mockResolvedValue([makeItem({ id: 'old', position: 2 })]);
    items.save.mockImplementation(async (rows: FeedbackItem[]) =>
      rows.map((row) => makeItem({ ...row, id: 'new-1' })),
    );
    queue.addBulk.mockRejectedValue(new Error('redis down'));

    await expect(
      service.addComments('batch-1', { comments: 'hello' }, actor),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(items.delete).toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('refuses a rerun when OpenRouter is not connected', async () => {
    openRouterKey = '';

    await expect(
      service.rerunFailed('batch-1', { model: 'vendor/free-model:free' }, actor),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(catalog.assertFreeModel).not.toHaveBeenCalled();
    expect(batches.save).not.toHaveBeenCalled();
  });

  it('requeues only failed comments on a new model and audits a count', async () => {
    items.find.mockResolvedValue([
      makeItem({ id: 'ok', status: 'coded', position: 1, finalTag: 'Praise' }),
      makeItem({
        id: 'bad',
        status: 'failed',
        position: 2,
        failedReason: 'Coding failed',
        finalTag: 'Bug',
        suggestedTag: 'Bug',
        summary: 'old',
      }),
      makeItem({ id: 'review', status: 'needs_review', position: 3 }),
    ]);
    batches.save.mockImplementation(async (value: FeedbackBatch) => value);
    queue.addBulk.mockResolvedValue([{ id: '99' }]);

    const detail = await service.rerunFailed(
      'batch-1',
      { model: 'vendor/free-model:free' },
      actor,
    );

    expect(catalog.assertFreeModel).toHaveBeenCalledWith('vendor/free-model:free');
    expect(batches.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'batch-1', model: 'vendor/free-model:free' }),
    );
    expect(items.update).toHaveBeenCalledWith(
      { id: In(['bad']) },
      { status: 'queued', failedReason: null, suggestedTag: null, summary: null },
    );
    expect(queue.addBulk).toHaveBeenCalledWith([
      { name: FEEDBACK_ITEM_JOB, data: { itemId: 'bad' }, opts: FEEDBACK_ITEM_JOB_OPTIONS },
    ]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'batch.rerun',
        targetType: 'batch',
        targetId: 'batch-1',
        metadata: { rerun: 1, model: 'vendor/free-model:free' },
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('12345');
    expect(detail.model).toBe('vendor/free-model:free');
    expect(detail.items.find((item) => item.id === 'bad')).toMatchObject({
      status: 'queued',
      failedReason: null,
      suggestedTag: null,
      summary: null,
      finalTag: 'Bug',
    });
    expect(detail.items.find((item) => item.id === 'ok')?.status).toBe('coded');
    expect(detail.items.find((item) => item.id === 'review')?.status).toBe('needs_review');
  });

  it('rejects a rerun model that is not free before writing', async () => {
    catalog.assertFreeModel.mockRejectedValue(
      new BadRequestException('Choose a free OpenRouter model'),
    );

    await expect(
      service.rerunFailed('batch-1', { model: 'paid/model' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(items.find).not.toHaveBeenCalled();
    expect(batches.save).not.toHaveBeenCalled();
    expect(items.update).not.toHaveBeenCalled();
    expect(queue.addBulk).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('refuses a rerun when no comment failed', async () => {
    items.find.mockResolvedValue([makeItem({ status: 'coded' })]);

    await expect(
      service.rerunFailed('batch-1', { model: 'vendor/free-model:free' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(batches.save).not.toHaveBeenCalled();
    expect(items.update).not.toHaveBeenCalled();
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('restores failed comments when queueing the rerun throws', async () => {
    items.find.mockResolvedValue([
      makeItem({ id: 'bad', status: 'failed', failedReason: 'Coding failed' }),
    ]);
    batches.save.mockImplementation(async (value: FeedbackBatch) => value);
    queue.addBulk.mockRejectedValue(new Error('redis down'));

    await expect(
      service.rerunFailed('batch-1', { model: 'vendor/free-model:free' }, actor),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(items.update).toHaveBeenCalledWith('bad', {
      status: 'failed',
      failedReason: 'Coding failed',
    });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('deletes one comment, its job, and its conversation', async () => {
    items.findOne.mockResolvedValue(
      makeItem({ id: 'item-9', jobId: '9', conversationId: 'conv-1', position: 4 }),
    );
    queue.remove.mockResolvedValue(1);

    await service.removeItem('batch-1', 'item-9', actor);

    expect(queue.remove).toHaveBeenCalledWith('9');
    expect(conversations.delete).toHaveBeenCalledWith({ id: 'conv-1' });
    expect(items.delete).toHaveBeenCalledWith({ id: 'item-9' });
    expect(audit.record).toHaveBeenCalledWith({
      actor,
      action: 'item.delete',
      targetType: 'feedback_item',
      targetId: 'item-9',
      metadata: { batchId: 'batch-1', position: 4, hadConversation: true },
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('12345');
  });

  it('rejects a missing comment without deleting', async () => {
    items.findOne.mockResolvedValue(null);

    await expect(service.removeItem('batch-1', 'missing', actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(items.delete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('accepts suggested tags only where the final tag is empty', async () => {
    const empty = makeItem({ id: 'a', suggestedTag: 'Bug' });
    const kept = makeItem({ id: 'b', suggestedTag: 'Bug', finalTag: 'Praise' });
    const noSuggestion = makeItem({ id: 'c' });
    items.find.mockResolvedValue([empty, kept, noSuggestion]);

    await expect(service.acceptSuggested('batch-1', actor)).resolves.toEqual({
      updated: 1,
    });
    expect(items.save).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a', finalTag: 'Bug' }),
    ]);
    expect(kept.finalTag).toBe('Praise');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'batch.accept_suggested',
        metadata: { updated: 1 },
      }),
    );
  });

  it('deletes a batch with its items, conversations, and jobs, and audits counts', async () => {
    items.find.mockResolvedValue([
      makeItem({ id: 'a', jobId: '1', conversationId: 'conv-1' }),
      makeItem({ id: 'b', jobId: '2' }),
    ]);
    queue.remove.mockResolvedValue(1);

    await service.remove('batch-1', actor);

    expect(queue.remove).toHaveBeenCalledTimes(2);
    expect(conversations.delete).toHaveBeenCalledTimes(1);
    expect(batches.delete).toHaveBeenCalledWith({ id: 'batch-1' });
    expect(audit.record).toHaveBeenCalledWith({
      actor,
      action: 'batch.delete',
      targetType: 'batch',
      targetId: 'batch-1',
      metadata: { itemCount: 2, conversationCount: 1 },
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('12345');
  });

  it('purges every batch created before the cutoff and returns counts', async () => {
    batches.find.mockResolvedValue([{ id: 'old-1' }, { id: 'old-2' }]);
    items.find
      .mockResolvedValueOnce([
        makeItem({ id: 'a', batchId: 'old-1', conversationId: 'conv-1' }),
        makeItem({ id: 'b', batchId: 'old-1', conversationId: 'conv-2' }),
      ])
      .mockResolvedValueOnce([makeItem({ id: 'c', batchId: 'old-2' })]);

    const counts = await service.purgeCreatedBefore(new Date('2026-09-01'));

    expect(counts).toEqual({ batches: 2, items: 3, conversations: 2 });
    expect(batches.delete).toHaveBeenCalledWith({ id: 'old-1' });
    expect(batches.delete).toHaveBeenCalledWith({ id: 'old-2' });
    // The caller audits the pass; the purge itself writes no audit row.
    expect(audit.record).not.toHaveBeenCalled();
  });
});

function modelChoice(
  overrides: Partial<OpenRouterModelChoice> & Pick<OpenRouterModelChoice, 'id' | 'name'>,
): OpenRouterModelChoice {
  return {
    description: '',
    contextLength: 8192,
    maxOutputTokens: 2048,
    inputModalities: ['text'],
    outputModalities: ['text'],
    supportsStructuredOutput: true,
    intelligenceIndex: null,
    codingIndex: null,
    agenticIndex: null,
    ...overrides,
  };
}
