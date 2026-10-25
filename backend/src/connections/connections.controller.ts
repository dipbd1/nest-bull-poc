import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ConnectionsService } from './connections.service.js';
import { isConnectionTool } from './connections.types.js';

@Controller('connections')
@UseGuards(AuthGuard, AdminGuard)
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  list() {
    return this.connections.list();
  }

  @Post(':tool/test')
  @HttpCode(HttpStatus.OK)
  test(@CurrentUser() user: RequestUser, @Param('tool') tool: string) {
    if (!isConnectionTool(tool)) {
      throw new NotFoundException('Unknown tool');
    }
    return this.connections.test(tool, { id: user.sub, email: user.email });
  }
}
