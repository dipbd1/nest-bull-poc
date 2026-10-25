import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { AppConfig } from '../config/app.config.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import type { RequestUser } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyRegistrationDto } from './dto/verify-registration.dto.js';
import { clearSessionCookie, setSessionCookie } from './session-cookie.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('config')
  config() {
    return this.authService.getPublicConfig();
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    if (!result.verificationRequired) {
      this.setSession(res, result.accessToken);
    }
    return result;
  }

  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body() dto: VerifyRegistrationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyRegistration(dto);
    this.setSession(res, result.accessToken);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setSession(res, result.accessToken);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearSessionCookie(res, this.isProduction());
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return this.authService.getProfile(user.sub);
  }

  private setSession(res: Response, token: string): void {
    setSessionCookie(
      res,
      token,
      this.isProduction(),
      this.authService.tokenExpiry(token),
    );
  }

  private isProduction(): boolean {
    return this.configService.getOrThrow<AppConfig>('app').isProduction;
  }
}
