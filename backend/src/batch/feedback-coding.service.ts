import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  JSONParseError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  TypeValidationError,
} from 'ai';
import { UnrecoverableError } from 'bullmq';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { AiProviderNotConfiguredError, AiRequestError } from '../ai/ai.errors.js';
import { AiService } from '../ai/ai.service.js';
import { OpenRouterCatalogService } from '../ai/openrouter-catalog.service.js';
import { ConversationService } from '../conversation/conversation.service.js';
import {
  FeedbackItem,
  type FeedbackItemStatus,
} from './entities/feedback-item.entity.js';

export const feedbackCodeSchema = z.object({
  tag: z.string(),
  summary: z.string(),
});

const MAX_SUMMARY_LENGTH = 300;

export type CodingJob = {
  id?: string | number;
  attemptsMade: number;
  opts: { attempts?: number };
};

export type FeedbackCodingResult = {
  itemId: string;
  status: FeedbackItemStatus | 'missing';
  conversationId: string | null;
  skipped: boolean;
};

export function codingSystemPrompt(tags: string[]): string {
  return [
    'You code one customer feedback comment.',
    `Choose exactly one tag from this list: ${JSON.stringify(tags)}.`,
    'Do not invent a tag.',
    'Return JSON with "tag" set to one of those tags and "summary" set to a summary of the comment in at most 20 words.',
  ].join(' ');
}

/** Output the model produced but that does not fit the schema. Not retried. */
export function isUnusableOutput(error: unknown): boolean {
  const cause = error instanceof AiRequestError ? error.cause : error;
  return (
    NoObjectGeneratedError.isInstance(cause) ||
    NoOutputGeneratedError.isInstance(cause) ||
    JSONParseError.isInstance(cause) ||
    TypeValidationError.isInstance(cause)
  );
}

export function matchTag(tags: string[], raw: string): string | null {
  const wanted = raw.trim().toLowerCase();
  return tags.find((tag) => tag.toLowerCase() === wanted) ?? null;
}

function safeFailureReason(error: unknown): string {
  if (
    error instanceof AiProviderNotConfiguredError ||
    error instanceof AiRequestError
  ) {
    return error.message;
  }
  return 'Coding failed';
}

function isFinalAttempt(job: CodingJob): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}

@Injectable()
export class FeedbackCodingService {
  private readonly logger = new Logger(FeedbackCodingService.name);

  constructor(
    @InjectRepository(FeedbackItem)
    private readonly items: Repository<FeedbackItem>,
    private readonly ai: AiService,
    private readonly conversations: ConversationService,
    private readonly catalog: OpenRouterCatalogService,
  ) {}

  async codeItem(job: CodingJob, itemId: string): Promise<FeedbackCodingResult> {
    const item = await this.items.findOne({
      where: { id: itemId },
      relations: { batch: true },
    });
    if (!item) {
      this.logger.warn(`Item ${itemId} no longer exists; skipping`);
      return { itemId, status: 'missing', conversationId: null, skipped: true };
    }
    if (item.status === 'coded' || item.status === 'needs_review') {
      return {
        itemId,
        status: item.status,
        conversationId: item.conversationId,
        skipped: true,
      };
    }

    const { batch } = item;
    try {
      await this.catalog.assertFreeModel(batch.model);
    } catch (error) {
      if (error instanceof BadRequestException) {
        const reason = 'Choose a free OpenRouter model';
        await this.markFailed(item, reason);
        throw new UnrecoverableError(reason);
      }
      throw error;
    }

    const provider = 'openrouter' as const;
    const systemContent = codingSystemPrompt(batch.tags);

    let output: z.infer<typeof feedbackCodeSchema> | null = null;
    try {
      const generated = await this.ai.generateObject({
        provider,
        model: batch.model,
        schema: feedbackCodeSchema,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: item.text },
        ],
      });
      output = generated.object;
    } catch (error) {
      if (!isUnusableOutput(error)) {
        if (isFinalAttempt(job)) {
          await this.markFailed(item, safeFailureReason(error));
        }
        throw error;
      }
    }

    const tag = output ? matchTag(batch.tags, output.tag) : null;
    const summary = output?.summary.trim().slice(0, MAX_SUMMARY_LENGTH) || null;
    const status: FeedbackItemStatus = tag ? 'coded' : 'needs_review';

    const jobId = String(job.id ?? item.id);
    const existing = await this.conversations.findByJobId(jobId);
    const conversation =
      existing ??
      (await this.conversations.createInitial({
        jobId,
        userId: batch.createdById,
        title: `${batch.title} #${item.position}`,
        provider,
        model: batch.model,
        systemContent,
        userContent: item.text,
        assistantContent: assistantLine(tag, output?.tag ?? null, summary),
      }));

    await this.items.update(item.id, {
      status,
      suggestedTag: tag,
      summary,
      conversationId: conversation.id,
      failedReason: null,
    });
    return {
      itemId,
      status,
      conversationId: conversation.id,
      skipped: false,
    };
  }

  private async markFailed(item: FeedbackItem, reason: string): Promise<void> {
    await this.items.update(item.id, { status: 'failed', failedReason: reason });
  }
}

function assistantLine(
  tag: string | null,
  rawTag: string | null,
  summary: string | null,
): string {
  if (tag) {
    return `Suggested tag: ${tag}. Summary: ${summary ?? 'none'}`;
  }
  if (rawTag) {
    return `The model suggested "${rawTag}", which is not one of this batch's tags, so a person needs to choose. Summary: ${summary ?? 'none'}`;
  }
  return 'The model did not return a usable tag, so a person needs to choose.';
}
