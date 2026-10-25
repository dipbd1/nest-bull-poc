import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
@UseGuards(AuthGuard, AdminGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Patch()
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto, { id: user.sub, email: user.email });
  }
}
