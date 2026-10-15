import { Injectable } from '@nestjs/common';
import { CreateProducerDto } from './dto/create-producer.dto.js';
import { UpdateProducerDto } from './dto/update-producer.dto.js';

import { Logger } from '@nestjs/common';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ProducerService {
  private readonly logger = new Logger(ProducerService.name);
  constructor(@InjectQueue('jobs') private readonly jobQueue: Queue) {}
  create(createProducerDto: CreateProducerDto) {
    this.jobQueue.add('jobs', createProducerDto);
    return createProducerDto;
    // return 'This action adds a new producer to the queue';
  }

  findAll() {
    const jobs = this.jobQueue.getJobs();
    return jobs;
  }

  findOne(id: number) {
    this.logger.log(`Finding job with id: ${id}`);
    const job = this.jobQueue.getJob(id.toString());
    return job.then((job) => job?.data ?? null);
  }

  update(id: number, updateProducerDto: UpdateProducerDto) {
    this.logger.log(`Updating job with id: ${id}`);
    const job = this.jobQueue.getJob(id.toString());
    job.then((job) => job?.updateData(updateProducerDto));
    return job.then((job) => job?.data ?? null);
  }

  remove(id: number) {
    this.logger.log(`Removing job with id: ${id}`);
    const job = this.jobQueue.getJob(id.toString());
    job.then((job) => job?.remove());
    return job.then((job) => job?.data ?? null);
  }

  removeAll() {
    this.logger.log(`Removing all jobs`);
    const jobs = this.jobQueue.getJobs();
    jobs.then((jobs) => jobs.forEach((job) => job.remove()));
    return jobs.then((jobs) => jobs.map((job) => job?.data ?? null));
  }
}
