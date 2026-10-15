import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ProducerController } from './producer.controller.js';
import { ProducerService } from './producer.service.js';
import { jobQueueName } from '../config/queue.config.js';

describe('ProducerController', () => {
  let controller: ProducerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProducerController],
      providers: [
        ProducerService,
        {
          provide: getQueueToken(jobQueueName),
          useValue: {
            add: vi.fn(),
            getJobs: vi.fn(),
            getJob: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProducerController>(ProducerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
