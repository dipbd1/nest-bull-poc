import type {
  BatchCounts,
  BatchDetail,
  BatchItem,
  BatchSummary,
  ItemStatus,
  NewBatchInput,
} from './types.ts'

/** Mirrors the limits the API enforces so the form can say so before sending. */
export const MIN_TAGS = 2
export const MAX_TAGS = 8
export const MAX_TAG_LENGTH = 40
export const MAX_COMMENTS = 100
export const MAX_COMMENT_LENGTH = 2000
export const MAX_TITLE_LENGTH = 200

/** One comment per line. Blank lines are dropped. */
export function parseCommentLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

export type NewBatchCheck = {
  commentCount: number
  /** First reason the batch cannot be created yet, or null when it can. */
  problem: string | null
}

export function checkNewBatch(input: NewBatchInput): NewBatchCheck {
  const lines = parseCommentLines(input.comments)
  const commentCount = lines.length
  const title = input.title.trim()

  if (!title) return { commentCount, problem: 'Add a title.' }
  if (input.tags.length < MIN_TAGS) {
    return { commentCount, problem: `Add at least ${MIN_TAGS} tags.` }
  }
  if (commentCount === 0) {
    return { commentCount, problem: 'Paste at least one comment.' }
  }
  if (commentCount > MAX_COMMENTS) {
    return {
      commentCount,
      problem: `A batch holds at most ${MAX_COMMENTS} comments. Remove ${commentCount - MAX_COMMENTS}.`,
    }
  }
  const tooLong = lines.findIndex((line) => line.length > MAX_COMMENT_LENGTH)
  if (tooLong !== -1) {
    return {
      commentCount,
      problem: `Comment ${tooLong + 1} is longer than ${MAX_COMMENT_LENGTH} characters.`,
    }
  }
  if (!input.model) return { commentCount, problem: 'Choose a model.' }
  return { commentCount, problem: null }
}

/** Comments pasted onto a batch that already has `existingCount` rows. */
export function checkAddedComments(
  existingCount: number,
  text: string,
): NewBatchCheck {
  const lines = parseCommentLines(text)
  const commentCount = lines.length
  const room = MAX_COMMENTS - existingCount
  if (commentCount === 0) {
    return { commentCount, problem: 'Paste at least one comment.' }
  }
  if (commentCount > room) {
    return {
      commentCount,
      problem:
        room <= 0
          ? `A batch holds at most ${MAX_COMMENTS} comments.`
          : `This batch can take ${room} more ${room === 1 ? 'comment' : 'comments'}.`,
    }
  }
  const tooLong = lines.findIndex((line) => line.length > MAX_COMMENT_LENGTH)
  if (tooLong !== -1) {
    return {
      commentCount,
      problem: `Comment ${tooLong + 1} is longer than ${MAX_COMMENT_LENGTH} characters.`,
    }
  }
  return { commentCount, problem: null }
}

export type CodingProgress = {
  done: number
  total: number
  finished: boolean
  text: string
}

/** Server counts in, the line of text the screens show out. */
export function codingProgress(counts: BatchCounts): CodingProgress {
  const { total, queued, failed } = counts
  if (total === 0) {
    return { done: 0, total: 0, finished: true, text: 'No comments yet' }
  }
  const done = Math.max(0, total - queued)
  const finished = queued === 0
  const finishedText =
    failed === 0
      ? `All ${total} coded`
      : failed === total
        ? `Coding failed for all ${total}`
        : `${total - failed} of ${total} coded, ${failed} failed`
  return {
    done,
    total,
    finished,
    text: finished ? finishedText : `Coding ${done} of ${total}`,
  }
}

/** Rows that still need a decision from a person. Never more than are left. */
export function needsPersonCount(counts: BatchCounts): number {
  const unresolved = Math.max(0, counts.total - counts.tagged - counts.queued)
  return Math.min(counts.needsReview + counts.failed, unresolved)
}

export function isNeedsYou(item: BatchItem): boolean {
  return item.status === 'needs_review' && !item.finalTag
}

export function isFailed(item: BatchItem): boolean {
  return item.status === 'failed'
}

export type ReviewFilter = 'all' | 'needs-you' | 'failed'

export function filterItems(
  items: BatchItem[],
  filter: ReviewFilter,
): BatchItem[] {
  if (filter === 'needs-you') return items.filter(isNeedsYou)
  if (filter === 'failed') return items.filter(isFailed)
  return items
}

export function filterCounts(items: BatchItem[]): Record<ReviewFilter, number> {
  return {
    all: items.length,
    'needs-you': items.filter(isNeedsYou).length,
    failed: items.filter(isFailed).length,
  }
}

/** Rows `accept-suggested` would fill: a suggestion and no final tag yet. */
export function acceptableCount(items: BatchItem[]): number {
  return items.filter((item) => item.suggestedTag && !item.finalTag).length
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: 'Waiting',
  coded: 'Coded',
  needs_review: 'Needs you',
  failed: 'Failed',
}

export function hasQueuedRows(batch: BatchSummary | BatchDetail | null) {
  return (batch?.counts.queued ?? 0) > 0
}

export function anyBatchQueued(batches: BatchSummary[]): boolean {
  return batches.some((batch) => batch.counts.queued > 0)
}

export function withItemUpdated(
  batch: BatchDetail,
  updated: BatchItem,
): BatchDetail {
  return {
    ...batch,
    items: batch.items.map((item) => (item.id === updated.id ? updated : item)),
  }
}

/** Reads `filename="..."` from a Content-Disposition header. */
export function filenameFromDisposition(
  header: string | null,
  fallback: string,
): string {
  const match = header?.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? fallback
}
