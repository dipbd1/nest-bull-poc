import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistrationCode } from '../auth/entities/registration-code.entity.js';
import { User } from '../auth/entities/user.entity.js';
import type { DatabaseConfig } from '../config/database.config.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const database = configService.getOrThrow<DatabaseConfig>('database');
        return {
          type: 'postgres' as const,
          url: database.url,
          ssl: true,
          entities: [User, RegistrationCode],
          synchronize: true,
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
