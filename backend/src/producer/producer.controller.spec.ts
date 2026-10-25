import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AuthGuard } from '../auth/auth.guard.js';
import { jobQueueName } from '../config/queue.config.js';
import { ProducerController } from './producer.controller.js';
import { ProducerService } from './producer.service.js';

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
            getJobs: vi.fn(),
            getJob: vi.fn(),
            getJobCounts: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProducerController>(ProducerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('has no create or edit route', () => {
    const proto = ProducerController.prototype as unknown as Record<
      string,
      unknown
    >;
    expect(proto.create).toBeUndefined();
    expect(proto.update).toBeUndefined();
    expect(proto.listModels).toBeUndefined();
  });
});
