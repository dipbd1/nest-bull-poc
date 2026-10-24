import { registerAs } from '@nestjs/config';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const envFiles = [
  resolve(moduleDir, '../../.env'),
  resolve(moduleDir, '../../../.env'),
  resolve(moduleDir, '../../../.env.local'),
];

for (const file of envFiles) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Missing env files are fine; shell-provided env still starts the app.
  }
}

export interface DatabaseConfig {
  url: string;
}

export function assertDatabaseEnv(config: Record<string, unknown>): void {
  const url = config.DATABASE_URL;
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('DATABASE_URL is required');
  }
}

function withConnectTimeout(connectionString: string): string {
  if (/[?&]connect_timeout=/.test(connectionString)) {
    return connectionString;
  }
  const separator = connectionString.includes('?') ? '&' : '?';
  return `${connectionString}${separator}connect_timeout=10`;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  return { url: withConnectTimeout(url) };
});
