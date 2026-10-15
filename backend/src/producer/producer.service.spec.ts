import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ProducerService } from './producer.service.js';
import { jobQueueName } from '../config/queue.config.js';

describe('ProducerService', () => {
  let service: ProducerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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

    service = module.get<ProducerService>(ProducerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
