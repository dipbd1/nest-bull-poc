import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue, type JobType } from 'bullmq';
import type { ListJobsQuery } from './dto/list-jobs-query.dto.js';
import { jobQueueName } from '../config/queue.config.js';
import type { QueueJobData } from '../queue/job-data.js';

export type ProducerJobView = {
  id: string;
  name: string;
  data: QueueJobData;
  state: string;
  attemptsMade: number;
  timestamp: number;
  failedReason: string | null;
};

export type ProducerJobPage = {
  items: ProducerJobView[];
  total: number;
  offset: number;
  limit: number;
};

/**
 * Read and remove access to the raw queue. Jobs are created only by the batch
 * service; there is no create or edit path here.
 */
@Injectable()
export class ProducerService {
  private readonly logger = new Logger(ProducerService.name);

  constructor(
    @InjectQueue(jobQueueName)
    private readonly jobQueue: Queue<QueueJobData>,
  ) {}

  async findAll(query: ListJobsQuery): Promise<ProducerJobPage> {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;
    const { state } = query;
    const jobType = state as JobType;
    const [jobs, counts] = await Promise.all([
      this.jobQueue.getJobs([jobType], offset, offset + limit - 1, false),
      this.jobQueue.getJobCounts(jobType),
    ]);
    const items = await Promise.all(jobs.map((job) => this.toJobView(job)));
    return {
      items,
      total: counts[state] ?? 0,
      offset,
      limit,
    };
  }

  async findOne(id: number) {
    this.logger.log(`Finding job with id: ${id}`);
    const job = await this.jobQueue.getJob(id.toString());
    if (!job) {
      return null;
    }
    return this.toJobView(job);
  }

  async remove(id: number) {
    this.logger.log(`Removing job with id: ${id}`);
    const job = await this.jobQueue.getJob(id.toString());
    if (!job) {
      return null;
    }
    const view = await this.toJobView(job);
    await job.remove();
    return view;
  }

  async removeAll() {
    this.logger.log(`Removing all jobs`);
    const jobs = await this.jobQueue.getJobs();
    const views = await Promise.all(jobs.map((job) => this.toJobView(job)));
    await Promise.all(jobs.map((job) => job.remove()));
    return views;
  }

  private async toJobView(job: Job<QueueJobData>): Promise<ProducerJobView> {
    return {
      id: String(job.id),
      name: job.name,
      data: job.data,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      failedReason: job.failedReason || null,
    };
  }
}
