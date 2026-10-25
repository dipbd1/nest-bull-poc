import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto.js';
import { ProducerService } from './producer.service.js';

/** Raw queue inspection. Batches create the jobs; this never does. */
@Controller('producer')
@UseGuards(AuthGuard)
export class ProducerController {
  constructor(private readonly producerService: ProducerService) {}

  @Get()
  findAll(@Query() query: ListJobsQueryDto) {
    return this.producerService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.producerService.findOne(+id);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.producerService.remove(+id);
  }

  @Delete()
  @UseGuards(AdminGuard)
  removeAll() {
    return this.producerService.removeAll();
  }
}
