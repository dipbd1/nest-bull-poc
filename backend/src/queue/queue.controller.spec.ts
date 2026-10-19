import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { jobQueueName } from '../config/queue.config.js';
import { QueueController } from './queue.controller.js';

describe('QueueController', () => {
  let controller: QueueController;
  const getJobCounts = vi.fn();

  beforeEach(async () => {
    getJobCounts.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        {
          provide: getQueueToken(jobQueueName),
          useValue: { getJobCounts },
        },
      ],
    }).compile();

    controller = module.get(QueueController);
  });

  it('returns named counts and a total', async () => {
    getJobCounts.mockResolvedValue({
      waiting: 1,
      active: 2,
      completed: 3,
      failed: 4,
      delayed: 5,
      paused: 6,
    });

    await expect(controller.status()).resolves.toEqual({
      name: jobQueueName,
      waiting: 1,
      active: 2,
      completed: 3,
      failed: 4,
      delayed: 5,
      paused: 6,
      total: 21,
    });
  });

  it('treats missing count keys as zero', async () => {
    getJobCounts.mockResolvedValue({});

    await expect(controller.status()).resolves.toEqual({
      name: jobQueueName,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      total: 0,
    });
  });
});
