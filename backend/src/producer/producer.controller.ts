import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { CreateProducerDto } from './dto/create-producer.dto.js';
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
  findAll() {
    return this.producerService.findAll();
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
