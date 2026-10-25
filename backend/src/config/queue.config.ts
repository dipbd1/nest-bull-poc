import { registerAs } from '@nestjs/config';
import process from 'node:process';
import { assertAiEnv } from './ai.config.js';
import { assertProductionEnv } from './app.config.js';
import { assertAuthEnv } from './auth.config.js';
import { assertDatabaseEnv } from './database.config.js';

try {
  process.loadEnvFile();
} catch {
  // Missing .env is fine; tests and shell-provided env still start.
}

const DEFAULT_QUEUE_NAME = 'jobs';
const DEFAULT_REDIS_HOST = 'localhost';
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_MODEL_REQUESTS_PER_MINUTE = 20;

export const jobQueueName =
  process.env.JOB_QUEUE_NAME?.trim() || DEFAULT_QUEUE_NAME;

export function readModelRequestsPerMinute(value: string | undefined): number {
  const parsed = Number.parseInt(value?.trim() ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MODEL_REQUESTS_PER_MINUTE;
}

export const modelRequestsPerMinute = readModelRequestsPerMinute(
  process.env.MODEL_REQUESTS_PER_MINUTE,
);

function readOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readTlsEnabled(value: string | undefined): boolean {
  const raw = value?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function validateEnv(config: Record<string, unknown>) {
  const redisPort = config.REDIS_PORT;
  if (
    redisPort !== undefined &&
    redisPort !== '' &&
    Number.isNaN(Number(redisPort))
  ) {
    throw new Error('REDIS_PORT must be a number');
  }

  assertAiEnv(config);
  assertDatabaseEnv(config);
  assertAuthEnv(config);
  assertProductionEnv(config);
  return config;
}

export const queueConfig = registerAs('queue', () => ({
  name: jobQueueName,
  redis: {
    host: process.env.REDIS_HOST?.trim() || DEFAULT_REDIS_HOST,
    port: Number.parseInt(
      process.env.REDIS_PORT ?? String(DEFAULT_REDIS_PORT),
      10,
    ),
    username: readOptionalString(process.env.REDIS_USERNAME),
    password: readOptionalString(process.env.REDIS_PASSWORD),
    tls: readTlsEnabled(process.env.REDIS_TLS),
  },
}));
