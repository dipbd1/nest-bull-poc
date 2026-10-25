import { Module } from '@nestjs/common';
import { BatchModule } from '../batch/batch.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { RetentionService } from './retention.service.js';

@Module({
  imports: [BatchModule, SettingsModule],
  providers: [RetentionService],
})
export class RetentionModule {}
