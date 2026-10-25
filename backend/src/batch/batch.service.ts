import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, LessThan, Repository } from 'typeorm';
import {
  OPENROUTER_NOT_CONNECTED,
  rankFreeModels,
  suggestedFreeModel,
} from '../ai/openrouter-catalog.js';
import { OpenRouterCatalogService } from '../ai/openrouter-catalog.service.js';
import { AuditService, type AuditActor } from '../audit/audit.service.js';
import type { AiConfig } from '../config/ai.config.js';
import { jobQueueName } from '../config/queue.config.js';
import { Conversation } from '../conversation/entities/conversation.entity.js';
import {
  FEEDBACK_ITEM_JOB,
  FEEDBACK_ITEM_JOB_OPTIONS,
  type QueueJobData,
} from '../queue/job-data.js';
import { csvFilename, itemsToCsv } from './batch.csv.js';
import {
  BatchInputError,
  MAX_COMMENTS,
  parseComments,
  parseTags,
} from './batch.limits.js';
import type {
  BatchCounts,
  BatchDetail,
  BatchModels,
  BatchSummary,
  FeedbackItemView,
} from './batch.types.js';
import { AddCommentsDto } from './dto/add-comments.dto.js';
import { CreateBatchDto } from './dto/create-batch.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';
import { FeedbackBatch } from './entities/feedback-batch.entity.js';
import {
  FeedbackItem,
  type FeedbackItemStatus,
} from './entities/feedback-item.entity.js';

export type PurgeCounts = {
  batches: number;
  items: number;
  conversations: number;
};

function emptyCounts(): BatchCounts {
  return {
    total: 0,
    queued: 0,
    coded: 0,
    needsReview: 0,
    failed: 0,
    tagged: 0,
  };
}

const COUNT_KEY: Record<FeedbackItemStatus, keyof BatchCounts> = {
  queued: 'queued',
  coded: 'coded',
  needs_review: 'needsReview',
  failed: 'failed',
};

export function countItems(items: FeedbackItem[]): BatchCounts {
  const counts = emptyCounts();
  for (const item of items) {
    counts.total += 1;
    counts[COUNT_KEY[item.status]] += 1;
    if (item.finalTag) counts.tagged += 1;
  }
  return counts;
}

function toItemView(item: FeedbackItem): FeedbackItemView {
  return {
    id: item.id,
    position: item.position,
    text: item.text,
    suggestedTag: item.suggestedTag,
    summary: item.summary,
    finalTag: item.finalTag,
    status: item.status,
    conversationId: item.conversationId,
    failedReason: item.failedReason,
  };
}

function toSummary(batch: FeedbackBatch, counts: BatchCounts): BatchSummary {
  return {
    id: batch.id,
    title: batch.title,
    model: batch.model,
    tags: batch.tags,
    createdById: batch.createdById,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    counts,
  };
}

function toDetail(batch: FeedbackBatch, items: FeedbackItem[]): BatchDetail {
  const sorted = [...items].sort((left, right) => left.position - right.position);
  return {
    ...toSummary(batch, countItems(sorted)),
    items: sorted.map(toItemView),
  };
}

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  private openRouter(): AiConfig['providers']['openrouter'] {
    return this.config.getOrThrow<AiConfig>('ai').providers.openrouter;
  }

  constructor(
    @InjectRepository(FeedbackBatch)
    private readonly batches: Repository<FeedbackBatch>,
    @InjectRepository(FeedbackItem)
    private readonly items: Repository<FeedbackItem>,
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectQueue(jobQueueName)
    private readonly queue: Queue<QueueJobData>,
    private readonly catalog: OpenRouterCatalogService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async models(): Promise<BatchModels> {
    const openrouter = this.openRouter();
    const models = rankFreeModels(await this.catalog.listFreeModels());
    return {
      models,
      defaultModel: suggestedFreeModel(models, openrouter.model),
      ready: Boolean(openrouter.apiKey),
    };
  }

  async create(dto: CreateBatchDto, actor: NonNullable<AuditActor>): Promise<BatchDetail> {
    let tags: string[];
    let comments: string[];
    try {
      tags = parseTags(dto.tags);
      comments = parseComments(dto.comments);
    } catch (error) {
      if (error instanceof BatchInputError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException('Title cannot be blank');
    }
    if (!this.openRouter().apiKey) {
      throw new ServiceUnavailableException(OPENROUTER_NOT_CONNECTED);
    }
    await this.catalog.assertFreeModel(dto.model);

    const batch = await this.batches.save(
      this.batches.create({
        title,
        model: dto.model,
        tags,
        createdById: actor.id,
      }),
    );
    const items = await this.items.save(
      comments.map((text, index) =>
        this.items.create({
          batchId: batch.id,
          position: index + 1,
          text,
          status: 'queued',
        }),
      ),
    );

    try {
      await this.enqueue(items);
    } catch (error) {
      this.logger.error(`Could not queue batch ${batch.id}`, error as Error);
      const failedReason = 'Could not queue this comment';
      await this.items.update({ batchId: batch.id }, { status: 'failed', failedReason });
      throw new ServiceUnavailableException('Could not queue the batch');
    }

    await this.audit.record({
      actor,
      action: 'batch.create',
      targetType: 'batch',
      targetId: batch.id,
      metadata: { itemCount: items.length, tags, model: dto.model },
    });
    return toDetail(batch, items);
  }

  /** Appends comments to an existing batch and queues each one for coding. */
  async addComments(
    batchId: string,
    dto: AddCommentsDto,
    actor: NonNullable<AuditActor>,
  ): Promise<BatchDetail> {
    const batch = await this.requireBatch(batchId);
    let comments: string[];
    try {
      comments = parseComments(dto.comments);
    } catch (error) {
      if (error instanceof BatchInputError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    const existing = await this.items.find({ where: { batchId } });
    if (existing.length + comments.length > MAX_COMMENTS) {
      const room = Math.max(0, MAX_COMMENTS - existing.length);
      throw new BadRequestException(
        room === 0
          ? `A batch can hold at most ${MAX_COMMENTS} comments`
          : `This batch can take ${room} more ${room === 1 ? 'comment' : 'comments'}`,
      );
    }
    if (!this.openRouter().apiKey) {
      throw new ServiceUnavailableException(OPENROUTER_NOT_CONNECTED);
    }

    const start =
      existing.reduce((max, item) => Math.max(max, item.position), 0) + 1;
    const created = await this.items.save(
      comments.map((text, index) =>
        this.items.create({
          batchId,
          position: start + index,
          text,
          status: 'queued',
        }),
      ),
    );

    try {
      await this.enqueue(created);
    } catch (error) {
      this.logger.error(`Could not queue comments for batch ${batchId}`, error as Error);
      await this.items.delete({ id: In(created.map((item) => item.id)) });
      throw new ServiceUnavailableException('Could not queue the comments');
    }

    await this.audit.record({
      actor,
      action: 'batch.add_comments',
      targetType: 'batch',
      targetId: batchId,
      metadata: { added: created.length, model: batch.model },
    });
    return toDetail(batch, [...existing, ...created]);
  }

  async list(): Promise<BatchSummary[]> {
    const batches = await this.batches.find({ order: { createdAt: 'DESC' } });
    if (batches.length === 0) return [];
    const items = await this.items.find({
      where: { batchId: In(batches.map((batch) => batch.id)) },
      select: { id: true, batchId: true, status: true, finalTag: true },
    });
    const byBatch = new Map<string, FeedbackItem[]>();
    for (const item of items) {
      const list = byBatch.get(item.batchId) ?? [];
      list.push(item);
      byBatch.set(item.batchId, list);
    }
    return batches.map((batch) =>
      toSummary(batch, countItems(byBatch.get(batch.id) ?? [])),
    );
  }

  async get(id: string): Promise<BatchDetail> {
    const batch = await this.requireBatch(id);
    const items = await this.items.find({
      where: { batchId: id },
      order: { position: 'ASC' },
    });
    return toDetail(batch, items);
  }

  async retag(
    batchId: string,
    itemId: string,
    dto: UpdateItemDto,
    actor: AuditActor,
  ): Promise<FeedbackItemView> {
    const batch = await this.requireBatch(batchId);
    const item = await this.items.findOne({ where: { id: itemId, batchId } });
    if (!item) {
      throw new NotFoundException('Comment not found');
    }
    const from = item.finalTag;
    const wanted = dto.finalTag.trim();
    if (wanted === '') {
      item.finalTag = null;
      await this.items.update(item.id, { finalTag: null });
      await this.audit.record({
        actor,
        action: 'item.retag',
        targetType: 'feedback_item',
        targetId: item.id,
        metadata: { batchId, position: item.position, from, to: null },
      });
      return toItemView(item);
    }

    const tag = batch.tags.find(
      (candidate) => candidate.toLowerCase() === wanted.toLowerCase(),
    );
    if (!tag) {
      throw new BadRequestException('Choose one of the batch tags');
    }

    item.finalTag = tag;
    await this.items.update(item.id, { finalTag: tag });
    await this.audit.record({
      actor,
      action: 'item.retag',
      targetType: 'feedback_item',
      targetId: item.id,
      metadata: { batchId, position: item.position, from, to: tag },
    });
    return toItemView(item);
  }

  async acceptSuggested(
    batchId: string,
    actor: AuditActor,
  ): Promise<{ updated: number }> {
    await this.requireBatch(batchId);
    const items = await this.items.find({ where: { batchId } });
    const pending = items.filter((item) => !item.finalTag && item.suggestedTag);
    for (const item of pending) {
      item.finalTag = item.suggestedTag;
    }
    if (pending.length > 0) {
      await this.items.save(pending);
    }
    await this.audit.record({
      actor,
      action: 'batch.accept_suggested',
      targetType: 'batch',
      targetId: batchId,
      metadata: { updated: pending.length },
    });
    return { updated: pending.length };
  }

  async exportCsv(
    batchId: string,
    actor: AuditActor,
  ): Promise<{ filename: string; csv: string }> {
    const batch = await this.requireBatch(batchId);
    const items = await this.items.find({
      where: { batchId },
      order: { position: 'ASC' },
    });
    const csv = itemsToCsv(items);
    await this.audit.record({
      actor,
      action: 'batch.export',
      targetType: 'batch',
      targetId: batchId,
      metadata: { rowCount: items.length },
    });
    return { filename: csvFilename(batch.title), csv };
  }

  /** Deletes one comment, its conversation, and its pending job. */
  async removeItem(
    batchId: string,
    itemId: string,
    actor: AuditActor,
  ): Promise<void> {
    await this.requireBatch(batchId);
    const item = await this.items.findOne({ where: { id: itemId, batchId } });
    if (!item) {
      throw new NotFoundException('Comment not found');
    }
    if (item.jobId) {
      await this.queue.remove(item.jobId).catch(() => {
        // An active job cannot be removed; the worker skips missing items.
      });
    }
    if (item.conversationId) {
      await this.conversations.delete({ id: item.conversationId });
    }
    await this.items.delete({ id: item.id });
    await this.audit.record({
      actor,
      action: 'item.delete',
      targetType: 'feedback_item',
      targetId: item.id,
      metadata: {
        batchId,
        position: item.position,
        hadConversation: Boolean(item.conversationId),
      },
    });
  }

  /** Deletes a batch, its items, their conversations, and pending jobs. */
  async remove(batchId: string, actor: AuditActor): Promise<void> {
    await this.requireBatch(batchId);
    const counts = await this.purge(batchId);
    await this.audit.record({
      actor,
      action: 'batch.delete',
      targetType: 'batch',
      targetId: batchId,
      metadata: {
        itemCount: counts.items,
        conversationCount: counts.conversations,
      },
    });
  }

  /**
   * Retention: deletes every batch created before `cutoff`, with its items and
   * conversations. Returns counts only. The caller writes the audit event.
   */
  async purgeCreatedBefore(cutoff: Date): Promise<PurgeCounts> {
    const old = await this.batches.find({
      where: { createdAt: LessThan(cutoff) },
      select: { id: true },
    });
    const total: PurgeCounts = { batches: 0, items: 0, conversations: 0 };
    for (const batch of old) {
      const counts = await this.purge(batch.id);
      total.batches += counts.batches;
      total.items += counts.items;
      total.conversations += counts.conversations;
    }
    return total;
  }

  /** Deletes one batch, its items, their conversations, and pending jobs. */
  private async purge(batchId: string): Promise<PurgeCounts> {
    const items = await this.items.find({ where: { batchId } });
    const conversationIds = items
      .map((item) => item.conversationId)
      .filter((id): id is string => Boolean(id));

    await Promise.all(
      items
        .map((item) => item.jobId)
        .filter((jobId): jobId is string => Boolean(jobId))
        .map((jobId) =>
          this.queue.remove(jobId).catch(() => {
            // An active job cannot be removed; the worker skips missing items.
          }),
        ),
    );
    if (conversationIds.length > 0) {
      await this.conversations.delete({ id: In(conversationIds) });
    }
    await this.batches.delete({ id: batchId });
    return {
      batches: 1,
      items: items.length,
      conversations: conversationIds.length,
    };
  }

  private async enqueue(items: FeedbackItem[]): Promise<void> {
    const jobs = await this.queue.addBulk(
      items.map((item) => ({
        name: FEEDBACK_ITEM_JOB,
        data: { itemId: item.id },
        opts: FEEDBACK_ITEM_JOB_OPTIONS,
      })),
    );
    await Promise.all(
      jobs.map((job, index) => {
        const jobId = String(job.id);
        items[index].jobId = jobId;
        return this.items.update(items[index].id, { jobId });
      }),
    );
  }

  private async requireBatch(id: string): Promise<FeedbackBatch> {
    const batch = await this.batches.findOne({ where: { id } });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }
    return batch;
  }
}
