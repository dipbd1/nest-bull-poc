import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { jobQueueName } from '../config/queue.config.js';

const COUNT_KEYS = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
] as const;

type CountKey = (typeof COUNT_KEYS)[number];

export type QueueStatus = Record<CountKey, number> & {
  name: string;
  total: number;
};

@Controller('queue')
export class QueueController {
  constructor(@InjectQueue(jobQueueName) private readonly jobQueue: Queue) {}

  @Get('status')
  async status(): Promise<QueueStatus> {
    const counts = await this.jobQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );
    const waiting = counts.waiting ?? 0;
    const active = counts.active ?? 0;
    const completed = counts.completed ?? 0;
    const failed = counts.failed ?? 0;
    const delayed = counts.delayed ?? 0;
    const paused = counts.paused ?? 0;

    return {
      name: jobQueueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + completed + failed + delayed + paused,
    };
  }
}
