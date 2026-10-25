import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AuthConfig } from '../config/auth.config.js';
import { Invite } from '../users/entities/invite.entity.js';
import { AdminGuard } from './admin.guard.js';
import { AuthBootstrap } from './auth.bootstrap.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { RegistrationCode } from './entities/registration-code.entity.js';
import { User } from './entities/user.entity.js';
import { MailService } from './mail.service.js';
import { OidcController } from './oidc/oidc.controller.js';
import { OidcService } from './oidc/oidc.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RegistrationCode, Invite]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const auth = configService.getOrThrow<AuthConfig>('auth');
        return {
          secret: auth.jwtSecret,
          signOptions: { expiresIn: auth.jwtExpiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController, OidcController],
  providers: [
    AuthService,
    MailService,
    OidcService,
    AuthGuard,
    AdminGuard,
    AuthBootstrap,
  ],
  exports: [
    AuthGuard,
    AdminGuard,
    AuthService,
    MailService,
    JwtModule,
    TypeOrmModule,
  ],
})
export class AuthModule {}
