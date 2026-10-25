import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import {
  FeedbackCodingService,
  type FeedbackCodingResult,
} from '../batch/feedback-coding.service.js';
import {
  jobQueueName,
  modelRequestsPerMinute,
} from '../config/queue.config.js';
import { type QueueJobData } from '../queue/job-data.js';

/** Every job on the queue is one feedback comment to code. */
@Processor(jobQueueName, {
  concurrency: 1,
  limiter: { max: modelRequestsPerMinute, duration: 60_000 },
})
export class ConsumerProcessor extends WorkerHost {
  constructor(private readonly coding: FeedbackCodingService) {
    super();
  }

  process(job: Job<QueueJobData>): Promise<FeedbackCodingResult> {
    const { itemId } = job.data;
    if (typeof itemId !== 'string' || itemId === '') {
      return Promise.reject(new Error('Job is missing itemId'));
    }
    return this.coding.codeItem(job, itemId);
  }
}
