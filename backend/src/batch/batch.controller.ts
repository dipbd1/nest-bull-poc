import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { BatchService } from './batch.service.js';
import { AddCommentsDto } from './dto/add-comments.dto.js';
import { CreateBatchDto } from './dto/create-batch.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';

function actorOf(user: RequestUser) {
  return { id: user.sub, email: user.email };
}

@Controller('batches')
@UseGuards(AuthGuard)
export class BatchController {
  constructor(private readonly batches: BatchService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBatchDto) {
    return this.batches.create(dto, actorOf(user));
  }

  @Get()
  list() {
    return this.batches.list();
  }

  @Get('models')
  models() {
    return this.batches.models();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.batches.get(id);
  }

  @Post(':id/comments')
  addComments(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCommentsDto,
  ) {
    return this.batches.addComments(id, dto, actorOf(user));
  }

  @Patch(':id/items/:itemId')
  retag(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.batches.retag(id, itemId, dto, actorOf(user));
  }

  @Post(':id/accept-suggested')
  @HttpCode(HttpStatus.OK)
  acceptSuggested(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.batches.acceptSuggested(id, actorOf(user));
  }

  @Get(':id/export')
  async export(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const { filename, csv } = await this.batches.exportCsv(id, actorOf(user));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return csv;
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    return this.batches.removeItem(id, itemId, actorOf(user));
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.batches.remove(id, actorOf(user));
  }
}
