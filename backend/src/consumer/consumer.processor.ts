import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { jobQueueName } from '../config/queue.config.js';

@Processor(jobQueueName)
export class ConsumerProcessor extends WorkerHost {
  async process(job: Job<unknown, unknown, string>) : Promise<any> {
    Logger.log(`I created this to start experiementing with some AI summarization feature with caching capabilities.
      my api will be running on some local pc of mine, but soon I be having other model provider to test.
      My initial plan is to use cache based on unique query text + model selection.`);
    Logger.log(job.data);
    return job.data;
  }
}