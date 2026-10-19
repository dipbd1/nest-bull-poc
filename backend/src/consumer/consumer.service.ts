import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConsumerProcessor } from './consumer.processor.js';

export type ConsumerStatus = {
  running: boolean;
};

@Injectable()
export class ConsumerService {
  constructor(private readonly processor: ConsumerProcessor) {}

  getStatus(): ConsumerStatus {
    return { running: !this.worker().isPaused() };
  }

  async setRunning(running: boolean): Promise<ConsumerStatus> {
    const worker = this.worker();
    if (running) {
      await worker.resume();
    } else {
      await worker.pause();
    }
    return { running: !worker.isPaused() };
  }

  private worker() {
    try {
      return this.processor.worker;
    } catch {
      throw new ServiceUnavailableException('Consumer worker is not ready');
    }
  }
}
