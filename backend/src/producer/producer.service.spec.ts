import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { OpenRouterCatalogService } from '../ai/openrouter-catalog.service.js';
import { jobQueueName } from '../config/queue.config.js';
import { ProducerService } from './producer.service.js';

function makeJob(overrides: Record<string, unknown> = {}) {
  const job = {
    id: '1',
    name: 'jobs',
    data: {
      name: 'alpha',
      description: 'first job',
      model: 'vendor/free-model:free',
      userId: 'user-1',
    },
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
  const catalog = {
    listFreeModels: vi.fn(),
    assertFreeModel: vi.fn(),
  };

  beforeEach(async () => {
    jobQueue.add.mockReset().mockResolvedValue(undefined);
    jobQueue.getJobs.mockReset();
    jobQueue.getJob.mockReset();
    catalog.listFreeModels.mockReset();
    catalog.assertFreeModel.mockReset().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProducerService,
        {
          provide: getQueueToken(jobQueueName),
          useValue: jobQueue,
        },
        { provide: OpenRouterCatalogService, useValue: catalog },
      ],
    }).compile();

    service = module.get(ProducerService);
  });

  it('enqueues the submitted payload with the signed-in user', async () => {
    const payload = {
      name: 'alpha',
      description: 'first job',
      model: 'vendor/free-model:free',
    };
    await expect(service.create(payload, 'user-1')).resolves.toEqual({
      ...payload,
      userId: 'user-1',
    });
    expect(catalog.assertFreeModel).toHaveBeenCalledWith(
      'vendor/free-model:free',
    );
    expect(jobQueue.add).toHaveBeenCalledWith('jobs', {
      ...payload,
      userId: 'user-1',
    });
  });

  it('does not enqueue a model that is not free', async () => {
    catalog.assertFreeModel.mockRejectedValue(
      new BadRequestException('Choose a free OpenRouter model'),
    );
    await expect(
      service.create(
        {
          name: 'alpha',
          description: 'first job',
          model: 'paid/model',
        },
        'user-1',
      ),
    ).rejects.toThrow('Choose a free OpenRouter model');
    expect(jobQueue.add).not.toHaveBeenCalled();
  });

  it('maps listed jobs to a plain view', async () => {
    jobQueue.getJobs.mockResolvedValue([makeJob()]);
    await expect(service.findAll()).resolves.toEqual([
      {
        id: '1',
        name: 'jobs',
        data: {
          name: 'alpha',
          description: 'first job',
          model: 'vendor/free-model:free',
          userId: 'user-1',
        },
        state: 'waiting',
        attemptsMade: 0,
        timestamp: 123,
        failedReason: null,
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
      data: {
        name: 'beta',
        description: 'first job',
        model: 'vendor/free-model:free',
        userId: 'user-1',
      },
    });
    expect(job.updateData).toHaveBeenCalledWith({
      name: 'beta',
      description: 'first job',
      model: 'vendor/free-model:free',
      userId: 'user-1',
    });
  });

  it('removes a job after mapping it', async () => {
    const job = makeJob();
    jobQueue.getJob.mockResolvedValue(job);
    await expect(service.remove(1)).resolves.toMatchObject({ id: '1' });
    expect(job.remove).toHaveBeenCalledOnce();
  });
});
