import { Test, TestingModule } from '@nestjs/testing';
import { ProducerController } from './producer.controller.js';
import { ProducerService } from './producer.service.js';

describe('ProducerController', () => {
  let controller: ProducerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProducerController],
      providers: [ProducerService],
    }).compile();

    controller = module.get<ProducerController>(ProducerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
