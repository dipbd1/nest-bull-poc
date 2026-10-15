import { Test, TestingModule } from '@nestjs/testing';
import { ConsumerController } from './consumer.controller.js';
import { ConsumerService } from './consumer.service.js';

describe('ConsumerController', () => {
  let controller: ConsumerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsumerController],
      providers: [ConsumerService],
    }).compile();

    controller = module.get<ConsumerController>(ConsumerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
