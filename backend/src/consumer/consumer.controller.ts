import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { ConsumerService } from './consumer.service.js';
import { UpdateConsumerDto } from './dto/update-consumer.dto.js';

@Controller('consumer')
@UseGuards(AuthGuard)
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

  @Get()
  getStatus() {
    return this.consumerService.getStatus();
  }

  @Patch()
  setStatus(@Body() dto: UpdateConsumerDto) {
    return this.consumerService.setRunning(dto.running);
  }
}
