import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditEvent } from './entities/audit-event.entity.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent]), AuthModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
