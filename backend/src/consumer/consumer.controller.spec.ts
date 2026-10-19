import { Test, TestingModule } from '@nestjs/testing';
import { ConsumerController } from './consumer.controller.js';
import { ConsumerService } from './consumer.service.js';

describe('ConsumerController', () => {
  let controller: ConsumerController;
  const consumerService = {
    getStatus: vi.fn(),
    setRunning: vi.fn(),
  };

  beforeEach(async () => {
    consumerService.getStatus.mockReset();
    consumerService.setRunning.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsumerController],
      providers: [{ provide: ConsumerService, useValue: consumerService }],
    }).compile();

    controller = module.get(ConsumerController);
  });

  it('returns the current worker status', () => {
    consumerService.getStatus.mockReturnValue({ running: true });
    expect(controller.getStatus()).toEqual({ running: true });
  });

  it('forwards a running update to the service', async () => {
    consumerService.setRunning.mockResolvedValue({ running: false });
    await expect(
      controller.setStatus({ running: false }),
    ).resolves.toEqual({ running: false });
    expect(consumerService.setRunning).toHaveBeenCalledWith(false);
  });
});
