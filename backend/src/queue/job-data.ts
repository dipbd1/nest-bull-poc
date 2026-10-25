export const FEEDBACK_ITEM_JOB = 'feedback-item';

export type FeedbackItemJobData = { itemId: string };

/** Every job on the queue codes one feedback item. */
export type QueueJobData = FeedbackItemJobData;

export const FEEDBACK_ITEM_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
};
