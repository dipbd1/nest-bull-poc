import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { EmbeddingModel, LanguageModel } from 'ai';
import type { AiConfig } from '../config/ai.config.js';
import { AiProviderNotConfiguredError } from './ai.errors.js';
import type { AiConnectionOverrides, AiProviderName } from './ai.types.js';

export interface ResolvedAiConnection {
  provider: AiProviderName;
  model: string;
  embeddingModel: string;
  baseUrl?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  name?: string;
  timeoutMs: number;
  maxRetries: number;
}

function pickString(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function pickNumber(
  callValue: number | undefined,
  adapterValue: number | undefined,
  fallback: number,
): number {
  if (callValue !== undefined) return callValue;
  if (adapterValue !== undefined) return adapterValue;
  return fallback;
}

export function resolveAiConnection(
  config: AiConfig,
  adapterOverrides: AiConnectionOverrides = {},
  callOverrides: AiConnectionOverrides = {},
): ResolvedAiConnection {
  const provider =
    callOverrides.provider ??
    adapterOverrides.provider ??
    config.defaultProvider;
  const providerConfig = config.providers[provider];

  return {
    provider,
    model:
      pickString(
        callOverrides.model,
        adapterOverrides.model,
        providerConfig.model,
      ) ?? '',
    embeddingModel:
      pickString(
        callOverrides.embeddingModel,
        adapterOverrides.embeddingModel,
        providerConfig.embeddingModel,
      ) ?? '',
    baseUrl: pickString(
      callOverrides.baseUrl,
      adapterOverrides.baseUrl,
      providerConfig.baseUrl,
    ),
    apiKey: pickString(
      callOverrides.apiKey,
      adapterOverrides.apiKey,
      providerConfig.apiKey,
    ),
    headers: callOverrides.headers ?? adapterOverrides.headers,
    name: pickString(
      callOverrides.name,
      adapterOverrides.name,
      providerConfig.name,
    ),
    timeoutMs: pickNumber(
      callOverrides.timeoutMs,
      adapterOverrides.timeoutMs,
      config.timeoutMs,
    ),
    maxRetries: pickNumber(
      callOverrides.maxRetries,
      adapterOverrides.maxRetries,
      config.maxRetries,
    ),
  };
}

function assertTransport(connection: ResolvedAiConnection): void {
  if (connection.provider === 'openai-compatible') {
    if (!connection.baseUrl) {
      throw new AiProviderNotConfiguredError(
        'openai-compatible',
        'Base URL is not configured for openai-compatible',
      );
    }
    return;
  }

  if (!connection.apiKey) {
    throw new AiProviderNotConfiguredError(
      connection.provider,
      `API key is not configured for ${connection.provider}`,
    );
  }
}

export function prepareChat(connection: ResolvedAiConnection): void {
  assertTransport(connection);
  if (!connection.model) {
    throw new AiProviderNotConfiguredError(
      connection.provider,
      `Chat model is not configured for ${connection.provider}`,
    );
  }
}

export function prepareEmbedding(connection: ResolvedAiConnection): void {
  if (connection.provider === 'anthropic') {
    throw new AiProviderNotConfiguredError(
      'anthropic',
      'Anthropic does not support embeddings',
    );
  }

  assertTransport(connection);
  if (!connection.embeddingModel) {
    throw new AiProviderNotConfiguredError(
      connection.provider,
      `Embedding model is not configured for ${connection.provider}`,
    );
  }
}

interface OfficialProviderSettings {
  apiKey: string;
  baseURL?: string;
  headers?: Record<string, string>;
}

function officialProviderSettings(
  connection: ResolvedAiConnection,
): OfficialProviderSettings {
  if (!connection.apiKey) {
    throw new AiProviderNotConfiguredError(
      connection.provider,
      `API key is not configured for ${connection.provider}`,
    );
  }

  return {
    apiKey: connection.apiKey,
    ...(connection.baseUrl ? { baseURL: connection.baseUrl } : {}),
    ...(connection.headers ? { headers: connection.headers } : {}),
  };
}

function compatibleProviderSettings(connection: ResolvedAiConnection): {
  name: string;
  baseURL: string;
  apiKey?: string;
  headers?: Record<string, string>;
} {
  if (!connection.baseUrl) {
    throw new AiProviderNotConfiguredError(
      'openai-compatible',
      'Base URL is not configured for openai-compatible',
    );
  }

  return {
    name: connection.name ?? 'openai-compatible',
    baseURL: connection.baseUrl,
    ...(connection.apiKey ? { apiKey: connection.apiKey } : {}),
    ...(connection.headers ? { headers: connection.headers } : {}),
  };
}

export function createChatModel(
  connection: ResolvedAiConnection,
): LanguageModel {
  switch (connection.provider) {
    case 'openai':
      return createOpenAI(officialProviderSettings(connection))(
        connection.model,
      );
    case 'anthropic':
      return createAnthropic(officialProviderSettings(connection))(
        connection.model,
      );
    case 'gemini':
      // The installed package exports createGoogleGenerativeAI, not createGoogle.
      return createGoogleGenerativeAI(officialProviderSettings(connection))(
        connection.model,
      );
    case 'openai-compatible':
      return createOpenAICompatible(compatibleProviderSettings(connection))(
        connection.model,
      );
    default: {
      const unknown: never = connection.provider;
      throw new Error(`Unsupported AI provider: ${String(unknown)}`);
    }
  }
}

export function createEmbeddingModel(
  connection: ResolvedAiConnection,
): EmbeddingModel {
  switch (connection.provider) {
    case 'openai':
      return createOpenAI(officialProviderSettings(connection)).embedding(
        connection.embeddingModel,
      );
    case 'gemini':
      return createGoogleGenerativeAI(
        officialProviderSettings(connection),
      ).embedding(connection.embeddingModel);
    case 'openai-compatible':
      // This provider exposes embeddingModel(), not embedding().
      return createOpenAICompatible(
        compatibleProviderSettings(connection),
      ).embeddingModel(connection.embeddingModel);
    case 'anthropic':
      throw new AiProviderNotConfiguredError(
        'anthropic',
        'Anthropic does not support embeddings',
      );
    default: {
      const unknown: never = connection.provider;
      throw new Error(`Unsupported AI provider: ${String(unknown)}`);
    }
  }
}

/**
 * embed() and embedMany() have no timeout argument. AbortSignal.timeout
 * carries timeoutMs for those calls.
 */
export function abortSignalFor(
  connection: ResolvedAiConnection,
  signal?: AbortSignal,
): AbortSignal | undefined {
  const timeoutSignal =
    connection.timeoutMs > 0
      ? AbortSignal.timeout(connection.timeoutMs)
      : undefined;
  if (timeoutSignal && signal) return AbortSignal.any([signal, timeoutSignal]);
  return signal ?? timeoutSignal;
}
