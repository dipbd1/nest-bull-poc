import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { OpenRouterCatalogService } from '../ai/openrouter-catalog.service.js';
import { CreateProducerDto } from './dto/create-producer.dto.js';
import { UpdateProducerDto } from './dto/update-producer.dto.js';
import { jobQueueName } from '../config/queue.config.js';

export type ProducerJobData = {
  name: string;
  description: string;
  model: string;
  userId: string;
};

export type ProducerJobView = {
  id: string;
  name: string;
  data: ProducerJobData;
  state: string;
  attemptsMade: number;
  timestamp: number;
  failedReason: string | null;
};

@Injectable()
export class ProducerService {
  private readonly logger = new Logger(ProducerService.name);

  constructor(
    @InjectQueue(jobQueueName)
    private readonly jobQueue: Queue<ProducerJobData>,
    private readonly catalog: OpenRouterCatalogService,
  ) {}

  listFreeModels() {
    return this.catalog.listFreeModels();
  }

  async create(createProducerDto: CreateProducerDto, userId: string) {
    await this.catalog.assertFreeModel(createProducerDto.model);
    const data: ProducerJobData = {
      name: createProducerDto.name,
      description: createProducerDto.description,
      model: createProducerDto.model,
      userId,
    };
    await this.jobQueue.add('jobs', data);
    return data;
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
    const model = updateProducerDto.model ?? job.data.model;
    if (!model) {
      throw new BadRequestException('Choose a free OpenRouter model');
    }
    if (updateProducerDto.model) {
      await this.catalog.assertFreeModel(updateProducerDto.model);
    }
    await job.updateData({
      name: updateProducerDto.name ?? job.data.name,
      description: updateProducerDto.description ?? job.data.description,
      model,
      userId: job.data.userId,
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
      failedReason: job.failedReason || null,
    };
  }
}
