import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AppConfig } from '../config/app.config.js';
import type { AuthConfig } from '../config/auth.config.js';
import {
  generateRegistrationCode,
  hashPassword,
  hashRegistrationCode,
  normalizeEmail,
  verifyPassword,
  verifyRegistrationCode,
} from './auth.crypto.js';
import type {
  AuthPublicConfig,
  AuthUser,
  RegisterResult,
} from './auth.types.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { VerifyRegistrationDto } from './dto/verify-registration.dto.js';
import { RegistrationCode } from './entities/registration-code.entity.js';
import { User } from './entities/user.entity.js';
import { MailService } from './mail.service.js';
import { readOidcSettings } from './oidc/oidc.client.js';

const INVALID_CODE_MESSAGE = 'Invalid or expired verification code';
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(RegistrationCode)
    private readonly codes: Repository<RegistrationCode>,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  getPublicConfig(): AuthPublicConfig {
    return {
      emailVerificationRequired: this.authConfig().emailVerificationRequired,
      publicRegistration: this.appConfig().allowPublicRegister,
      companyLogin:
        readOidcSettings(
          (key) => this.config.get<string>(key),
          this.appConfig().webOrigin,
        ) !== null,
    };
  }

  /** Creates the first admin from env when no user exists yet. */
  async bootstrapAdmin(): Promise<void> {
    const bootstrap = this.appConfig().bootstrapAdmin;
    if (!bootstrap) return;
    if ((await this.users.count()) > 0) return;

    await this.users.save(
      this.users.create({
        email: normalizeEmail(bootstrap.email),
        passwordHash: await hashPassword(bootstrap.password),
        emailVerifiedAt: new Date(),
        role: 'admin',
      }),
    );
    this.logger.log('Created the bootstrap admin from BOOTSTRAP_ADMIN_EMAIL');
  }

  async register(dto: RegisterDto): Promise<RegisterResult> {
    if (!this.appConfig().allowPublicRegister) {
      throw new ForbiddenException('Registration is closed');
    }
    const auth = this.authConfig();
    const email = normalizeEmail(dto.email);
    const existing = await this.users.findOne({ where: { email } });

    if (existing?.emailVerifiedAt) {
      throw new ConflictException('Email is already registered');
    }

    if (!auth.emailVerificationRequired) {
      return this.registerWithoutVerification(email, dto.password, existing);
    }

    if (existing) {
      const latest = await this.latestCode(existing.id);
      if (
        latest &&
        Date.now() - latest.createdAt.getTime() < auth.resendWindowMs
      ) {
        throw new HttpException(
          'Please wait before requesting another code',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const passwordHash = await hashPassword(dto.password);
    if (existing) {
      existing.passwordHash = passwordHash;
    }
    const user = existing
      ? await this.users.save(existing)
      : await this.users.save(
          this.users.create({
            email,
            passwordHash,
            emailVerifiedAt: null,
          }),
        );

    await this.codes.delete({ userId: user.id });

    const code = generateRegistrationCode();
    await this.codes.save(
      this.codes.create({
        userId: user.id,
        codeHash: hashRegistrationCode(code, auth.jwtSecret),
        expiresAt: new Date(Date.now() + auth.codeTtlMs),
        attempts: 0,
      }),
    );

    await this.mail.sendRegistrationCode(email, code);
    return { email, verificationRequired: true };
  }

  async verifyRegistration(
    dto: VerifyRegistrationDto,
  ): Promise<{ accessToken: string }> {
    const auth = this.authConfig();
    const email = normalizeEmail(dto.email);
    const user = await this.users.findOne({ where: { email } });
    const record = user ? await this.latestCode(user.id) : null;

    if (!user || !record) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }

    if (record.attempts >= auth.codeMaxAttempts) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }

    if (!verifyRegistrationCode(dto.code, record.codeHash, auth.jwtSecret)) {
      record.attempts += 1;
      await this.codes.save(record);
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }

    user.emailVerifiedAt = new Date();
    await this.users.save(user);
    await this.codes.delete({ userId: user.id });
    return { accessToken: await this.issueToken(user) };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const email = normalizeEmail(dto.email);
    const user = await this.users.findOne({ where: { email } });
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (this.authConfig().emailVerificationRequired && !user.emailVerifiedAt) {
      throw new ForbiddenException('Email is not verified');
    }

    if (user.disabledAt) {
      throw new ForbiddenException('Account is disabled');
    }

    return { accessToken: await this.issueToken(user) };
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.disabledAt) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      role: user.role,
    };
  }

  /** Expiry of a token this service issued, for the cookie `Expires`. */
  tokenExpiry(token: string): Date | undefined {
    const decoded = this.jwt.decode<{ exp?: number } | null>(token);
    return decoded?.exp ? new Date(decoded.exp * 1000) : undefined;
  }

  issueToken(user: User): Promise<string> {
    return this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      sv: user.sessionVersion,
    });
  }

  private async registerWithoutVerification(
    email: string,
    password: string,
    existing: User | null,
  ): Promise<Extract<RegisterResult, { verificationRequired: false }>> {
    const passwordHash = await hashPassword(password);
    const verifiedAt = new Date();
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.emailVerifiedAt = verifiedAt;
    }
    const user = existing
      ? await this.users.save(existing)
      : await this.users.save(
          this.users.create({
            email,
            passwordHash,
            emailVerifiedAt: verifiedAt,
          }),
        );

    return {
      email,
      verificationRequired: false,
      accessToken: await this.issueToken(user),
    };
  }

  private authConfig(): AuthConfig {
    return this.config.getOrThrow<AuthConfig>('auth');
  }

  private appConfig(): AppConfig {
    return this.config.getOrThrow<AppConfig>('app');
  }

  private latestCode(userId: string): Promise<RegistrationCode | null> {
    return this.codes.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
