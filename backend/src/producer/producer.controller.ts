import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { CreateProducerDto } from './dto/create-producer.dto.js';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto.js';
import { UpdateProducerDto } from './dto/update-producer.dto.js';
import { ProducerService } from './producer.service.js';

@Controller('producer')
@UseGuards(AuthGuard)
export class ProducerController {
  constructor(private readonly producerService: ProducerService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createProducerDto: CreateProducerDto,
  ) {
    return this.producerService.create(createProducerDto, user.sub);
  }

  @Get()
  findAll(@Query() query: ListJobsQueryDto) {
    return this.producerService.findAll(query);
  }

  @Get('models')
  listModels() {
    return this.producerService.listFreeModels();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.producerService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProducerDto: UpdateProducerDto) {
    return this.producerService.update(+id, updateProducerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.producerService.remove(+id);
  }

  @Delete()
  removeAll() {
    return this.producerService.removeAll();
  }
}
