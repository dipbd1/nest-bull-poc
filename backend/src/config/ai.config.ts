import { registerAs } from '@nestjs/config';
import process from 'node:process';
import {
  AI_PROVIDER_NAMES,
  isAiProviderName,
  type AiProviderName,
} from '../ai/ai.types.js';

try {
  process.loadEnvFile();
} catch {
  // Missing .env is fine; tests and shell-provided env still start.
}

const DEFAULT_PROVIDER: AiProviderName = 'openai';
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_COMPATIBLE_NAME = 'openai-compatible';
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_OPENROUTER_NAME = 'openrouter';

export interface AiProviderSettings {
  apiKey: string;
  model: string;
  embeddingModel: string;
  baseUrl: string;
  name: string;
  headers: Record<string, string>;
}

export interface AiConfig {
  defaultProvider: AiProviderName;
  timeoutMs: number;
  maxRetries: number;
  providers: Record<AiProviderName, AiProviderSettings>;
}

export function assertAiEnv(config: Record<string, unknown>): void {
  const provider = config.AI_DEFAULT_PROVIDER;
  if (provider !== undefined && provider !== '') {
    const value = typeof provider === 'string' ? provider.trim() : '';
    if (!isAiProviderName(value)) {
      throw new Error(
        `AI_DEFAULT_PROVIDER must be one of: ${AI_PROVIDER_NAMES.join(', ')}`,
      );
    }
  }

  for (const key of ['AI_TIMEOUT_MS', 'AI_MAX_RETRIES'] as const) {
    const value = config[key];
    if (value !== undefined && value !== '' && Number.isNaN(Number(value))) {
      throw new Error(`${key} must be a number`);
    }
  }
}

function readString(value: string | undefined): string {
  return value?.trim() ?? '';
}

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readDefaultProvider(): AiProviderName {
  const raw = readString(process.env.AI_DEFAULT_PROVIDER);
  if (!raw) return DEFAULT_PROVIDER;
  if (!isAiProviderName(raw)) {
    throw new Error(
      `AI_DEFAULT_PROVIDER must be one of: ${AI_PROVIDER_NAMES.join(', ')}`,
    );
  }
  return raw;
}

function openRouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const siteUrl = readString(process.env.OPENROUTER_SITE_URL);
  const appName = readString(process.env.OPENROUTER_APP_NAME);
  if (siteUrl) headers['HTTP-Referer'] = siteUrl;
  if (appName) headers['X-Title'] = appName;
  return headers;
}

export const aiConfig = registerAs('ai', (): AiConfig => ({
  defaultProvider: readDefaultProvider(),
  timeoutMs: readNumber(process.env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  maxRetries: readNumber(process.env.AI_MAX_RETRIES, DEFAULT_MAX_RETRIES),
  providers: {
    openai: {
      apiKey: readString(process.env.OPENAI_API_KEY),
      model: readString(process.env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL,
      embeddingModel:
        readString(process.env.OPENAI_EMBEDDING_MODEL) ||
        DEFAULT_OPENAI_EMBEDDING_MODEL,
      baseUrl: readString(process.env.OPENAI_BASE_URL),
      name: '',
      headers: {},
    },
    anthropic: {
      apiKey: readString(process.env.ANTHROPIC_API_KEY),
      model: readString(process.env.ANTHROPIC_MODEL) || DEFAULT_ANTHROPIC_MODEL,
      embeddingModel: '',
      baseUrl: readString(process.env.ANTHROPIC_BASE_URL),
      name: '',
      headers: {},
    },
    gemini: {
      apiKey: readString(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
      model: readString(process.env.GEMINI_MODEL) || DEFAULT_GEMINI_MODEL,
      embeddingModel:
        readString(process.env.GEMINI_EMBEDDING_MODEL) ||
        DEFAULT_GEMINI_EMBEDDING_MODEL,
      baseUrl: readString(process.env.GEMINI_BASE_URL),
      name: '',
      headers: {},
    },
    'openai-compatible': {
      apiKey: readString(process.env.OPENAI_COMPATIBLE_API_KEY),
      model: readString(process.env.OPENAI_COMPATIBLE_MODEL),
      embeddingModel: readString(process.env.OPENAI_COMPATIBLE_EMBEDDING_MODEL),
      baseUrl: readString(process.env.OPENAI_COMPATIBLE_BASE_URL),
      name:
        readString(process.env.OPENAI_COMPATIBLE_NAME) ||
        DEFAULT_COMPATIBLE_NAME,
      headers: {},
    },
    openrouter: {
      apiKey: readString(process.env.OPENROUTER_API_KEY),
      model:
        readString(process.env.OPENROUTER_MODEL) || DEFAULT_OPENROUTER_MODEL,
      embeddingModel: readString(process.env.OPENROUTER_EMBEDDING_MODEL),
      baseUrl:
        readString(process.env.OPENROUTER_BASE_URL) ||
        DEFAULT_OPENROUTER_BASE_URL,
      name: DEFAULT_OPENROUTER_NAME,
      headers: openRouterHeaders(),
    },
  },
}));
