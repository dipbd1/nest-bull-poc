import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthConfig } from '../config/auth.config.js';
import { AuthService } from './auth.service.js';
import {
  hashPassword,
  hashRegistrationCode,
  verifyRegistrationCode,
} from './auth.crypto.js';
import { RegistrationCode } from './entities/registration-code.entity.js';
import { User } from './entities/user.entity.js';
import { MailService } from './mail.service.js';

const authConfig: AuthConfig = {
  jwtSecret: 'test-secret',
  jwtExpiresIn: '1d' as const,
  smtp: { host: 'localhost', port: 1025 },
  mailFrom: 'noreply@localhost',
  codeTtlMs: 10 * 60 * 1000,
  codeMaxAttempts: 5,
  resendWindowMs: 60 * 1000,
};

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    passwordHash: 'salt:hash',
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    registrationCodes: [],
    ...overrides,
  };
}

function makeCode(overrides: Partial<RegistrationCode> = {}): RegistrationCode {
  return {
    id: 'code-1',
    userId: 'user-1',
    codeHash: hashRegistrationCode('123456', authConfig.jwtSecret),
    expiresAt: new Date(Date.now() + authConfig.codeTtlMs),
    attempts: 0,
    createdAt: new Date(),
    user: undefined as unknown as User,
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let users: {
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let codes: {
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mail: { sendRegistrationCode: ReturnType<typeof vi.fn> };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    users = {
      findOne: vi.fn(),
      save: vi.fn(async (user: User) => {
        user.id ??= 'user-1';
        return user;
      }),
      create: vi.fn((user: Partial<User>) => user),
    };
    codes = {
      findOne: vi.fn(),
      save: vi.fn(async (code: RegistrationCode) => code),
      create: vi.fn((code: Partial<RegistrationCode>) => code),
      delete: vi.fn(),
    };
    mail = { sendRegistrationCode: vi.fn() };
    jwt = { signAsync: vi.fn().mockResolvedValue('token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(RegistrationCode), useValue: codes },
        { provide: MailService, useValue: mail },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn((key: string) => {
              if (key === 'auth') return authConfig;
              throw new Error(`unexpected config key ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('registers an unverified user and emails a code', async () => {
    users.findOne.mockResolvedValue(null);

    const result = await service.register({
      email: 'Ada@Example.com',
      password: 'password1',
    });

    expect(result).toEqual({
      email: 'ada@example.com',
      verificationRequired: true,
    });
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        emailVerifiedAt: null,
      }),
    );
    expect(mail.sendRegistrationCode).toHaveBeenCalledWith(
      'ada@example.com',
      expect.stringMatching(/^\d{6}$/),
    );
    const sentCode = mail.sendRegistrationCode.mock.calls[0][1] as string;
    const savedCode = codes.save.mock.calls[0][0] as RegistrationCode;
    expect(
      verifyRegistrationCode(sentCode, savedCode.codeHash, authConfig.jwtSecret),
    ).toBe(true);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rejects a second registration request within the resend window', async () => {
    users.findOne.mockResolvedValue(makeUser());
    codes.findOne.mockResolvedValue(
      makeCode({ createdAt: new Date(Date.now() - 10_000) }),
    );

    const error = await service
      .register({ email: 'ada@example.com', password: 'password1' })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(mail.sendRegistrationCode).not.toHaveBeenCalled();
  });

  it('rejects registration when the email is already verified', async () => {
    users.findOne.mockResolvedValue(
      makeUser({ emailVerifiedAt: new Date() }),
    );

    await expect(
      service.register({ email: 'ada@example.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('verifies a valid code and issues a token', async () => {
    const user = makeUser();
    users.findOne.mockResolvedValue(user);
    codes.findOne.mockResolvedValue(makeCode());

    const result = await service.verifyRegistration({
      email: 'ada@example.com',
      code: '123456',
    });

    expect(result).toEqual({ accessToken: 'token' });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(users.save).toHaveBeenCalledWith(user);
    expect(codes.delete).toHaveBeenCalledWith({ userId: user.id });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
    });
  });

  it('does not issue a token for a wrong code', async () => {
    const record = makeCode();
    users.findOne.mockResolvedValue(makeUser());
    codes.findOne.mockResolvedValue(record);

    await expect(
      service.verifyRegistration({
        email: 'ada@example.com',
        code: '000000',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(record.attempts).toBe(1);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('does not issue a token for an expired code', async () => {
    users.findOne.mockResolvedValue(makeUser());
    codes.findOne.mockResolvedValue(
      makeCode({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(
      service.verifyRegistration({
        email: 'ada@example.com',
        code: '123456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rejects login for an unverified user', async () => {
    const passwordHash = await hashPassword('password1');
    users.findOne.mockResolvedValue(makeUser({ passwordHash }));

    await expect(
      service.login({ email: 'ada@example.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('logs in a verified user without a code', async () => {
    const passwordHash = await hashPassword('password1');
    users.findOne.mockResolvedValue(
      makeUser({ passwordHash, emailVerifiedAt: new Date() }),
    );

    const result = await service.login({
      email: 'ada@example.com',
      password: 'password1',
    });

    expect(result).toEqual({ accessToken: 'token' });
    expect(mail.sendRegistrationCode).not.toHaveBeenCalled();
    expect(jwt.signAsync).toHaveBeenCalled();
  });

  it('rejects login with the wrong password', async () => {
    const passwordHash = await hashPassword('password1');
    users.findOne.mockResolvedValue(
      makeUser({ passwordHash, emailVerifiedAt: new Date() }),
    );

    await expect(
      service.login({ email: 'ada@example.com', password: 'wrongpass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
