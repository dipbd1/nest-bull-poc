import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuditService } from './audit.service.js';
import { ListAuditQueryDto } from './dto/list-audit-query.dto.js';

@Controller('audit')
@UseGuards(AuthGuard, AdminGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: ListAuditQueryDto) {
    return this.audit.list(query.offset ?? 0, query.limit ?? 50);
  }
}
