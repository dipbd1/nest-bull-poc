import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { CreateProducerDto } from './dto/create-producer.dto.js';
import { UpdateProducerDto } from './dto/update-producer.dto.js';
import { jobQueueName } from '../config/queue.config.js';

export type ProducerJobData = {
  name: string;
  description: string;
};

export type ProducerJobView = {
  id: string;
  name: string;
  data: ProducerJobData;
  state: string;
  attemptsMade: number;
  timestamp: number;
};

@Injectable()
export class ProducerService {
  private readonly logger = new Logger(ProducerService.name);

  constructor(
    @InjectQueue(jobQueueName)
    private readonly jobQueue: Queue<ProducerJobData>,
  ) {}

  async create(createProducerDto: CreateProducerDto) {
    await this.jobQueue.add('jobs', createProducerDto);
    return createProducerDto;
  }

  async findAll() {
    const jobs = await this.jobQueue.getJobs();
    return Promise.all(jobs.map((job) => this.toJobView(job)));
  }

  async findOne(id: number) {
    this.logger.log(`Finding job with id: ${id}`);
    const job = await this.jobQueue.getJob(id.toString());
    if (!job) {
      return null;
    }
    return this.toJobView(job);
  }

  async update(id: number, updateProducerDto: UpdateProducerDto) {
    this.logger.log(`Updating job with id: ${id}`);
    const job = await this.jobQueue.getJob(id.toString());
    if (!job) {
      return null;
    }
    await job.updateData({
      name: updateProducerDto.name ?? job.data.name,
      description: updateProducerDto.description ?? job.data.description,
    });
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

  private async toJobView(job: Job<ProducerJobData>): Promise<ProducerJobView> {
    return {
      id: String(job.id),
      name: job.name,
      data: job.data,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    };
  }
}
