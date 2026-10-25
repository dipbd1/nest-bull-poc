import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from '../audit/entities/audit-event.entity.js';
import { RegistrationCode } from '../auth/entities/registration-code.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { FeedbackBatch } from '../batch/entities/feedback-batch.entity.js';
import { FeedbackItem } from '../batch/entities/feedback-item.entity.js';
import type { AppConfig } from '../config/app.config.js';
import { ConversationMessage } from '../conversation/entities/conversation-message.entity.js';
import { Conversation } from '../conversation/entities/conversation.entity.js';
import type { DatabaseConfig } from '../config/database.config.js';
import { AppSettings } from '../settings/entities/app-settings.entity.js';
import { Invite } from '../users/entities/invite.entity.js';
import { InitialSchema1761400000000 } from './migrations/1761400000000-initial-schema.js';
import { FeedbackDesk1761400000001 } from './migrations/1761400000001-feedback-desk.js';

export const ENTITIES = [
  User,
  RegistrationCode,
  Conversation,
  ConversationMessage,
  FeedbackBatch,
  FeedbackItem,
  AuditEvent,
  Invite,
  AppSettings,
];

export const MIGRATIONS = [InitialSchema1761400000000, FeedbackDesk1761400000001];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const database = configService.getOrThrow<DatabaseConfig>('database');
        const { isProduction } = configService.getOrThrow<AppConfig>('app');
        return {
          type: 'postgres' as const,
          url: database.url,
          ssl: true,
          entities: ENTITIES,
          migrations: MIGRATIONS,
          synchronize: !isProduction,
          migrationsRun: isProduction,
          uuidExtension: 'pgcrypto' as const,
          extra: {
            max: 10,
            connectionTimeoutMillis: 10_000,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
