import { registerAs } from '@nestjs/config';
import process from 'node:process';
import { assertAiEnv } from './ai.config.js';
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

export const jobQueueName =
  process.env.JOB_QUEUE_NAME?.trim() || DEFAULT_QUEUE_NAME;

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
  },
}));
