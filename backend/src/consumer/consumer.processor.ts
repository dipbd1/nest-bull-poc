import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

@Processor('jobs')
export class ConsumerProcessor extends WorkerHost {
  async process(job: Job<unknown, unknown, string>) : Promise<any> {
    Logger.log(job.data);
    job.moveToCompleted('completed', 'success');
    return job.data;
  }
}