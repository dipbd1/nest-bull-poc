import { Injectable } from '@nestjs/common';
import { CreateProducerDto } from './dto/create-producer.dto.js';
import { UpdateProducerDto } from './dto/update-producer.dto.js';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ProducerService {

  constructor(@InjectQueue('jobs') private readonly jobQueue: Queue) {}
  create(createProducerDto: CreateProducerDto) {
    this.jobQueue.add('jobs', createProducerDto);
    return 'This action adds a new producer to the queue';
  }

  findAll() {
    return `This action returns all producer`;
  }

  findOne(id: number) {
    return `This action returns a #${id} producer`;
  }

  update(id: number, updateProducerDto: UpdateProducerDto) {
    return `This action updates a #${id} producer`;
  }

  remove(id: number) {
    return `This action removes a #${id} producer`;
  }
}
