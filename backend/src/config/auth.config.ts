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
}

export function assertAuthEnv(config: Record<string, unknown>): void {
  const port = config.SMTP_PORT;
  if (port !== undefined && port !== '' && Number.isNaN(Number(port))) {
    throw new Error('SMTP_PORT must be a number');
  }
}

export const authConfig = registerAs(
  'auth',
  (): AuthConfig => ({
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
  }),
);
