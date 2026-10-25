import type { OpenRouterModelChoice } from '../ai/openrouter-catalog.js';
import type { FeedbackItemStatus } from './entities/feedback-item.entity.js';

export type BatchCounts = {
  total: number;
  queued: number;
  coded: number;
  needsReview: number;
  failed: number;
  /** Items with a final tag set by a person or by accept-suggested. */
  tagged: number;
};

export type BatchSummary = {
  id: string;
  title: string;
  model: string;
  tags: string[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
  counts: BatchCounts;
};

export type FeedbackItemView = {
  id: string;
  position: number;
  text: string;
  suggestedTag: string | null;
  summary: string | null;
  finalTag: string | null;
  status: FeedbackItemStatus;
  conversationId: string | null;
  failedReason: string | null;
};

export type BatchDetail = BatchSummary & { items: FeedbackItemView[] };

export type BatchModels = {
  models: OpenRouterModelChoice[];
  defaultModel: string;
  ready: boolean;
};
