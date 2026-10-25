import {
  Body,
  Controller,
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
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { setSessionCookie } from '../auth/session-cookie.js';
import type { AppConfig } from '../config/app.config.js';
import { AcceptInviteDto } from './dto/accept-invite.dto.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

function actorOf(user: RequestUser) {
  return { id: user.sub, email: user.email };
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  list() {
    return this.users.list();
  }

  @Get('invites')
  @UseGuards(AuthGuard, AdminGuard)
  listInvites() {
    return this.users.listPendingInvites();
  }

  @Post('invites')
  @UseGuards(AuthGuard, AdminGuard)
  invite(@CurrentUser() user: RequestUser, @Body() dto: CreateInviteDto) {
    return this.users.invite(dto, actorOf(user));
  }

  @Post('invites/accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.users.acceptInvite(dto);
    setSessionCookie(
      res,
      result.accessToken,
      this.config.getOrThrow<AppConfig>('app').isProduction,
      this.auth.tokenExpiry(result.accessToken),
    );
    return result;
  }

  @Patch(':id')
  @UseGuards(AuthGuard, AdminGuard)
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto, actorOf(user));
  }
}
