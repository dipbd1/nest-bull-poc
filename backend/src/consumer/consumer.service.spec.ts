import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConsumerProcessor } from './consumer.processor.js';
import { ConsumerService } from './consumer.service.js';

describe('ConsumerService', () => {
  let service: ConsumerService;
  const worker = {
    pause: vi.fn(),
    resume: vi.fn(),
    isPaused: vi.fn(),
  };
  let workerReady = true;

  beforeEach(async () => {
    worker.pause.mockReset().mockResolvedValue(undefined);
    worker.resume.mockReset().mockResolvedValue(undefined);
    worker.isPaused.mockReset().mockReturnValue(false);
    workerReady = true;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumerService,
        {
          provide: ConsumerProcessor,
          useValue: {
            get worker() {
              if (!workerReady) {
                throw new Error('Worker has not yet been initialized');
              }
              return worker;
            },
          },
        },
      ],
    }).compile();

    service = module.get(ConsumerService);
  });

  it('reports running when the worker is not paused', () => {
    worker.isPaused.mockReturnValue(false);
    expect(service.getStatus()).toEqual({ running: true });
  });

  it('reports stopped when the worker is paused', () => {
    worker.isPaused.mockReturnValue(true);
    expect(service.getStatus()).toEqual({ running: false });
  });

  it('pauses the worker when running is false', async () => {
    worker.isPaused.mockReturnValue(true);
    await expect(service.setRunning(false)).resolves.toEqual({ running: false });
    expect(worker.pause).toHaveBeenCalledOnce();
    expect(worker.resume).not.toHaveBeenCalled();
  });

  it('resumes the worker when running is true', async () => {
    worker.isPaused.mockReturnValue(false);
    await expect(service.setRunning(true)).resolves.toEqual({ running: true });
    expect(worker.resume).toHaveBeenCalledOnce();
    expect(worker.pause).not.toHaveBeenCalled();
  });

  it('returns 503 when the worker is not ready', () => {
    workerReady = false;
    expect(() => service.getStatus()).toThrow(ServiceUnavailableException);
  });
});
