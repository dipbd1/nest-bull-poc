import { registerAs } from '@nestjs/config';
import process from 'node:process';

try {
  process.loadEnvFile();
} catch {
  // Missing .env is fine; tests and shell-provided env still start.
}

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 5432;
const DEFAULT_USER = 'app';
const DEFAULT_PASSWORD = 'app';
const DEFAULT_NAME = 'app';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

export function assertDatabaseEnv(config: Record<string, unknown>): void {
  const port = config.POSTGRES_PORT;
  if (port !== undefined && port !== '' && Number.isNaN(Number(port))) {
    throw new Error('POSTGRES_PORT must be a number');
  }
}

export const databaseConfig = registerAs(
  'database',
  (): DatabaseConfig => ({
    host: process.env.POSTGRES_HOST?.trim() || DEFAULT_HOST,
    port: Number.parseInt(
      process.env.POSTGRES_PORT ?? String(DEFAULT_PORT),
      10,
    ),
    user: process.env.POSTGRES_USER?.trim() || DEFAULT_USER,
    password: process.env.POSTGRES_PASSWORD?.trim() || DEFAULT_PASSWORD,
    name: process.env.POSTGRES_DB?.trim() || DEFAULT_NAME,
  }),
);
