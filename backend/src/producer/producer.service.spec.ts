import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { jobQueueName } from '../config/queue.config.js';
import { ProducerService } from './producer.service.js';

function makeJob(overrides: Record<string, unknown> = {}) {
  const job = {
    id: '1',
    name: 'jobs',
    data: { name: 'alpha', description: 'first job' },
    attemptsMade: 0,
    timestamp: 123,
    getState: vi.fn().mockResolvedValue('waiting'),
    updateData: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  job.updateData.mockImplementation(async (data: typeof job.data) => {
    job.data = data;
  });
  return job;
}

describe('ProducerService', () => {
  let service: ProducerService;
  const jobQueue = {
    add: vi.fn(),
    getJobs: vi.fn(),
    getJob: vi.fn(),
  };

  beforeEach(async () => {
    jobQueue.add.mockReset().mockResolvedValue(undefined);
    jobQueue.getJobs.mockReset();
    jobQueue.getJob.mockReset();

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

  it('enqueues the submitted payload and returns it', async () => {
    const payload = { name: 'alpha', description: 'first job' };
    await expect(service.create(payload)).resolves.toEqual(payload);
    expect(jobQueue.add).toHaveBeenCalledWith('jobs', payload);
  });

  it('maps listed jobs to a plain view', async () => {
    jobQueue.getJobs.mockResolvedValue([makeJob()]);
    await expect(service.findAll()).resolves.toEqual([
      {
        id: '1',
        name: 'jobs',
        data: { name: 'alpha', description: 'first job' },
        state: 'waiting',
        attemptsMade: 0,
        timestamp: 123,
      },
    ]);
  });

  it('returns null when a job is missing', async () => {
    jobQueue.getJob.mockResolvedValue(undefined);
    await expect(service.findOne(9)).resolves.toBeNull();
  });

  it('merges patch data onto the existing job', async () => {
    const job = makeJob();
    jobQueue.getJob.mockResolvedValue(job);
    await expect(
      service.update(1, { name: 'beta' }),
    ).resolves.toMatchObject({
      data: { name: 'beta', description: 'first job' },
    });
    expect(job.updateData).toHaveBeenCalledWith({
      name: 'beta',
      description: 'first job',
    });
  });

  it('removes a job after mapping it', async () => {
    const job = makeJob();
    jobQueue.getJob.mockResolvedValue(job);
    await expect(service.remove(1)).resolves.toMatchObject({ id: '1' });
    expect(job.remove).toHaveBeenCalledOnce();
  });
});
