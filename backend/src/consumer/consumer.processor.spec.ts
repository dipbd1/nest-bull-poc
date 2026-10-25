import { Test, TestingModule } from '@nestjs/testing';
import { FeedbackCodingService } from '../batch/feedback-coding.service.js';
import { ConsumerProcessor } from './consumer.processor.js';

describe('ConsumerProcessor', () => {
  let processor: ConsumerProcessor;
  const coding = { codeItem: vi.fn() };

  beforeEach(async () => {
    coding.codeItem.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumerProcessor,
        { provide: FeedbackCodingService, useValue: coding },
      ],
    }).compile();

    processor = module.get(ConsumerProcessor);
  });

  it('hands an itemId job to the feedback coder', async () => {
    const result = {
      itemId: 'item-1',
      status: 'coded',
      conversationId: 'conv-9',
      skipped: false,
    };
    coding.codeItem.mockResolvedValue(result);
    const job = { id: '7', data: { itemId: 'item-1' }, attemptsMade: 0, opts: {} };

    await expect(processor.process(job as never)).resolves.toEqual(result);
    expect(coding.codeItem).toHaveBeenCalledWith(job, 'item-1');
  });

  it('fails a job that has no itemId, such as an old name and description job', async () => {
    const job = {
      id: '42',
      data: { name: 'alpha', description: 'summarize this', model: 'm' },
    };

    await expect(processor.process(job as never)).rejects.toThrow(
      'Job is missing itemId',
    );
    expect(coding.codeItem).not.toHaveBeenCalled();
  });
});
