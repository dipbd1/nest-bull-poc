import { registerAs } from '@nestjs/config';
import process from 'node:process';
import { isAiProviderName, type AiProviderName } from '../ai/ai.types.js';

const DEFAULT_WEB_ORIGIN = 'http://localhost:5173';
const DEV_JWT_SECRET = 'dev-jwt-secret';
const TRUE_VALUES = new Set(['true', '1', 'yes']);

const PROVIDER_KEY_ENV: Record<AiProviderName, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GOOGLE_GENERATIVE_AI_API_KEY',
  'openai-compatible': 'OPENAI_COMPATIBLE_BASE_URL',
  openrouter: 'OPENROUTER_API_KEY',
};

export interface AppConfig {
  isProduction: boolean;
  webOrigin: string;
  allowPublicRegister: boolean;
  bootstrapAdmin: { email: string; password: string } | null;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isProductionEnv(env: Record<string, unknown>): boolean {
  return readString(env.NODE_ENV) === 'production';
}

export function readFlag(value: unknown): boolean {
  return TRUE_VALUES.has(readString(value).toLowerCase());
}

export function resolveWebOrigin(env: Record<string, unknown>): string {
  const raw = readString(env.WEB_ORIGIN);
  if (!raw) return isProductionEnv(env) ? '' : DEFAULT_WEB_ORIGIN;
  return new URL(raw).origin;
}

/**
 * Production must not fall back to any development default. Returns every
 * problem at once so the operator can fix the environment in one pass.
 */
export function productionEnvProblems(env: Record<string, unknown>): string[] {
  if (!isProductionEnv(env)) return [];
  const problems: string[] = [];

  const webOrigin = readString(env.WEB_ORIGIN);
  if (!webOrigin) {
    problems.push('WEB_ORIGIN is required');
  } else {
    try {
      new URL(webOrigin);
    } catch {
      problems.push('WEB_ORIGIN must be an absolute URL');
    }
  }

  const jwtSecret = readString(env.JWT_SECRET);
  if (!jwtSecret || jwtSecret === DEV_JWT_SECRET) {
    problems.push('JWT_SECRET must be set to a non-default value');
  }

  if (!readString(env.DATABASE_URL)) {
    problems.push('DATABASE_URL is required');
  }

  if (!readString(env.REDIS_HOST)) {
    problems.push('REDIS_HOST is required');
  }

  const provider = readString(env.AI_DEFAULT_PROVIDER) || 'openai';
  if (isAiProviderName(provider)) {
    const keyEnv = PROVIDER_KEY_ENV[provider];
    if (!readString(env[keyEnv])) {
      problems.push(`${keyEnv} is required for AI_DEFAULT_PROVIDER=${provider}`);
    }
  }

  return problems;
}

export function assertProductionEnv(env: Record<string, unknown>): void {
  const problems = productionEnvProblems(env);
  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production: ${problems.join('; ')}`,
    );
  }
}

export const appConfig = registerAs('app', (): AppConfig => {
  const env = process.env as Record<string, unknown>;
  const isProduction = isProductionEnv(env);
  const email = readString(env.BOOTSTRAP_ADMIN_EMAIL);
  const password = readString(env.BOOTSTRAP_ADMIN_PASSWORD);
  return {
    isProduction,
    webOrigin: resolveWebOrigin(env),
    allowPublicRegister: !isProduction && readFlag(env.ALLOW_PUBLIC_REGISTER),
    bootstrapAdmin: email && password ? { email, password } : null,
  };
});
