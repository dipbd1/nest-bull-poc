import { registerAs } from '@nestjs/config';
import type { StringValue } from 'ms';
import process from 'node:process';

try {
  process.loadEnvFile();
} catch {
  // Missing .env is fine; tests and shell-provided env still start.
}

const DEFAULT_JWT_SECRET = 'dev-jwt-secret';
const DEFAULT_JWT_EXPIRES_IN: StringValue = '1d';
const DEFAULT_SMTP_HOST = 'localhost';
const DEFAULT_SMTP_PORT = 1025;
const DEFAULT_MAIL_FROM = 'noreply@localhost';
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;
const RESEND_WINDOW_MS = 60 * 1000;
const TRUE_VALUES = new Set(['true', '1', 'yes']);
const FALSE_VALUES = new Set(['false', '0', 'no']);

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: StringValue;
  smtp: {
    host: string;
    port: number;
  };
  mailFrom: string;
  codeTtlMs: number;
  codeMaxAttempts: number;
  resendWindowMs: number;
  emailVerificationRequired: boolean;
}

export function parseEmailVerificationRequired(
  value: string | undefined,
): boolean {
  if (value === undefined || value.trim() === '') {
    return true;
  }

  const raw = value.trim().toLowerCase();
  if (TRUE_VALUES.has(raw)) {
    return true;
  }
  if (FALSE_VALUES.has(raw)) {
    return false;
  }

  throw new Error(
    'EMAIL_VERIFICATION_REQUIRED must be true, false, 1, 0, yes, or no',
  );
}

export function assertAuthEnv(config: Record<string, unknown>): void {
  const port = config.SMTP_PORT;
  if (port !== undefined && port !== '' && Number.isNaN(Number(port))) {
    throw new Error('SMTP_PORT must be a number');
  }

  const flag = config.EMAIL_VERIFICATION_REQUIRED;
  if (flag !== undefined && flag !== '') {
    if (typeof flag !== 'string') {
      throw new Error(
        'EMAIL_VERIFICATION_REQUIRED must be true, false, 1, 0, yes, or no',
      );
    }
    parseEmailVerificationRequired(flag);
  }
}

export const authConfig = registerAs('auth', (): AuthConfig => ({
  jwtSecret: process.env.JWT_SECRET?.trim() || DEFAULT_JWT_SECRET,
  jwtExpiresIn:
    (process.env.JWT_EXPIRES_IN?.trim() as StringValue | undefined) ||
    DEFAULT_JWT_EXPIRES_IN,
  smtp: {
    host: process.env.SMTP_HOST?.trim() || DEFAULT_SMTP_HOST,
    port: Number.parseInt(
      process.env.SMTP_PORT ?? String(DEFAULT_SMTP_PORT),
      10,
    ),
  },
  mailFrom: process.env.MAIL_FROM?.trim() || DEFAULT_MAIL_FROM,
  codeTtlMs: CODE_TTL_MS,
  codeMaxAttempts: CODE_MAX_ATTEMPTS,
  resendWindowMs: RESEND_WINDOW_MS,
  emailVerificationRequired: parseEmailVerificationRequired(
    process.env.EMAIL_VERIFICATION_REQUIRED,
  ),
}));
