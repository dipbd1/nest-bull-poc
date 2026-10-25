import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { jobQueueName } from '../config/queue.config.js';
import { ProducerService } from './producer.service.js';

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    name: 'feedback-item',
    data: { itemId: 'item-1' },
    attemptsMade: 0,
    timestamp: 123,
    getState: vi.fn().mockResolvedValue('waiting'),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ProducerService', () => {
  let service: ProducerService;
  const jobQueue = {
    getJobs: vi.fn(),
    getJob: vi.fn(),
    getJobCounts: vi.fn(),
  };

  beforeEach(async () => {
    jobQueue.getJobs.mockReset();
    jobQueue.getJob.mockReset();
    jobQueue.getJobCounts.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProducerService,
        {
          provide: getQueueToken(jobQueueName),
          useValue: jobQueue,
        },
      ],
    }).compile();

    service = module.get(ProducerService);
  });

  it('pages jobs for one state newest first', async () => {
    jobQueue.getJobs.mockResolvedValue([makeJob()]);
    jobQueue.getJobCounts.mockResolvedValue({ waiting: 1 });
    await expect(
      service.findAll({ state: 'waiting', offset: 0, limit: 20 }),
    ).resolves.toEqual({
      items: [
        {
          id: '1',
          name: 'feedback-item',
          data: { itemId: 'item-1' },
          state: 'waiting',
          attemptsMade: 0,
          timestamp: 123,
          failedReason: null,
        },
      ],
      total: 1,
      offset: 0,
      limit: 20,
    });
    expect(jobQueue.getJobs).toHaveBeenCalledWith(['waiting'], 0, 19, false);
    expect(jobQueue.getJobCounts).toHaveBeenCalledWith('waiting');
  });

  it('defaults offset and limit when paging jobs', async () => {
    jobQueue.getJobs.mockResolvedValue([]);
    jobQueue.getJobCounts.mockResolvedValue({ completed: 0 });
    await expect(service.findAll({ state: 'completed' })).resolves.toEqual({
      items: [],
      total: 0,
      offset: 0,
      limit: 20,
    });
    expect(jobQueue.getJobs).toHaveBeenCalledWith(['completed'], 0, 19, false);
  });

  it('pages the paused list', async () => {
    jobQueue.getJobs.mockResolvedValue([]);
    jobQueue.getJobCounts.mockResolvedValue({ paused: 0 });
    await expect(
      service.findAll({ state: 'paused', offset: 20, limit: 20 }),
    ).resolves.toMatchObject({ total: 0, offset: 20, limit: 20 });
    expect(jobQueue.getJobs).toHaveBeenCalledWith(['paused'], 20, 39, false);
    expect(jobQueue.getJobCounts).toHaveBeenCalledWith('paused');
  });

  it('returns null when a job is missing', async () => {
    jobQueue.getJob.mockResolvedValue(undefined);
    await expect(service.findOne(9)).resolves.toBeNull();
  });

  it('removes a job after mapping it', async () => {
    const job = makeJob();
    jobQueue.getJob.mockResolvedValue(job);
    await expect(service.remove(1)).resolves.toMatchObject({ id: '1' });
    expect(job.remove).toHaveBeenCalledOnce();
  });
});
