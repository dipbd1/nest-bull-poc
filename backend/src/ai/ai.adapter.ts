import { Logger } from '@nestjs/common';
import {
  embed,
  embedMany,
  generateText,
  Output,
  streamText,
  type ModelMessage,
  type UserContent,
} from 'ai';
import type { ZodType } from 'zod';
import type { AiConfig } from '../config/ai.config.js';
import {
  abortSignalFor,
  createChatModel,
  createEmbeddingModel,
  prepareChat,
  prepareEmbedding,
  resolveAiConnection,
  type ResolvedAiConnection,
} from './ai-connection.js';
import { AiProviderNotConfiguredError, AiRequestError } from './ai.errors.js';
import type {
  AiAdapter,
  AiCallMeta,
  AiConnectionOverrides,
  AiContentPart,
  AiEmbedInput,
  AiEmbedManyInput,
  AiEmbedManyResult,
  AiEmbedResult,
  AiGenerateObjectInput,
  AiGenerateTextInput,
  AiMessage,
  AiObjectResult,
  AiPromptInput,
  AiSchemaOutput,
  AiStreamResult,
  AiTextResult,
  AiUsage,
} from './ai.types.js';

interface AdapterContext {
  config: AiConfig;
  overrides?: AiConnectionOverrides;
  logger: Logger;
}

export function createAiAdapter({
  config,
  overrides = {},
  logger,
}: AdapterContext): AiAdapter {
  return {
    generateText: (input) => runGenerateText(config, overrides, logger, input),
    generateObject: (input) =>
      runGenerateObject(config, overrides, logger, input),
    streamText: (input) => runStreamText(config, overrides, logger, input),
    embed: (input) => runEmbed(config, overrides, logger, input),
    embedMany: (input) => runEmbedMany(config, overrides, logger, input),
  };
}

function connectionFor(
  config: AiConfig,
  overrides: AiConnectionOverrides,
  call: AiConnectionOverrides,
): ResolvedAiConnection {
  return resolveAiConnection(config, overrides, call);
}

function metaFor(connection: ResolvedAiConnection, model: string): AiCallMeta {
  return {
    provider: connection.provider,
    model,
    baseUrl: connection.baseUrl,
    usage: {},
  };
}

function toLanguageUsage(usage: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): AiUsage {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };
}

function toEmbeddingUsage(usage: { tokens?: number }): AiUsage {
  return { totalTokens: usage.tokens };
}

function logSuccess(
  logger: Logger,
  meta: AiCallMeta,
  startedAt: number,
  usage: AiUsage,
): void {
  logger.log(
    `provider=${meta.provider} model=${meta.model} durationMs=${Date.now() - startedAt} usage=${JSON.stringify(usage)}`,
  );
}

function logFailure(logger: Logger, meta: AiCallMeta, startedAt: number): void {
  logger.error(
    `provider=${meta.provider} model=${meta.model} durationMs=${Date.now() - startedAt} failed`,
  );
}

async function runRequest<T>(
  logger: Logger,
  meta: AiCallMeta,
  startedAt: number,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof AiProviderNotConfiguredError ||
      error instanceof AiRequestError
    ) {
      throw error;
    }
    logFailure(logger, meta, startedAt);
    throw new AiRequestError(meta.provider, meta.model, error);
  }
}

function toImageUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error('Image content must be an absolute URL');
  }
}

function toUserContent(content: string | AiContentPart[]): UserContent {
  if (typeof content === 'string') return content;
  return content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text' as const, text: part.text };
    }
    return { type: 'image' as const, image: toImageUrl(part.image) };
  });
}

function toModelMessages(messages: AiMessage[]): ModelMessage[] {
  return messages.map((message) => {
    if (message.role === 'user') {
      return { role: 'user', content: toUserContent(message.content) };
    }
    return message;
  });
}

function toPrompt(
  input: AiPromptInput,
): { prompt: string } | { messages: ModelMessage[] } {
  const hasPrompt = input.prompt !== undefined;
  const hasMessages = input.messages !== undefined;
  if (hasPrompt && hasMessages) {
    throw new Error('Provide either a prompt or messages, not both');
  }
  if (!hasPrompt && !hasMessages) {
    throw new Error('Provide a prompt or messages');
  }
  if (hasPrompt) return { prompt: input.prompt ?? '' };
  return { messages: toModelMessages(input.messages ?? []) };
}

function sampling(input: AiGenerateTextInput): {
  temperature?: number;
  maxOutputTokens?: number;
} {
  return {
    ...(input.temperature !== undefined
      ? { temperature: input.temperature }
      : {}),
    ...(input.maxOutputTokens !== undefined
      ? { maxOutputTokens: input.maxOutputTokens }
      : {}),
  };
}

async function runGenerateText(
  config: AiConfig,
  overrides: AiConnectionOverrides,
  logger: Logger,
  input: AiGenerateTextInput,
): Promise<AiTextResult> {
  const connection = connectionFor(config, overrides, input);
  prepareChat(connection);
  const prompt = toPrompt(input);
  const meta = metaFor(connection, connection.model);
  const startedAt = Date.now();

  return runRequest(logger, meta, startedAt, async () => {
    const generated = await generateText({
      model: createChatModel(connection),
      ...prompt,
      ...sampling(input),
      maxRetries: connection.maxRetries,
      timeout: connection.timeoutMs,
      abortSignal: input.abortSignal,
    });
    const usage = toLanguageUsage(generated.usage);
    logSuccess(logger, meta, startedAt, usage);
    return { ...meta, text: generated.text, usage };
  });
}

async function runGenerateObject<SCHEMA extends ZodType>(
  config: AiConfig,
  overrides: AiConnectionOverrides,
  logger: Logger,
  input: AiGenerateObjectInput<SCHEMA>,
): Promise<AiObjectResult<AiSchemaOutput<SCHEMA>>> {
  const connection = connectionFor(config, overrides, input);
  prepareChat(connection);
  const prompt = toPrompt(input);
  const meta = metaFor(connection, connection.model);
  const startedAt = Date.now();

  return runRequest(logger, meta, startedAt, async () => {
    const generated = await generateText({
      model: createChatModel(connection),
      ...prompt,
      ...sampling(input),
      maxRetries: connection.maxRetries,
      timeout: connection.timeoutMs,
      abortSignal: input.abortSignal,
      output: Output.object({ schema: input.schema }),
    });
    const usage = toLanguageUsage(generated.usage);
    logSuccess(logger, meta, startedAt, usage);
    return {
      ...meta,
      object: generated.output as AiSchemaOutput<SCHEMA>,
      usage,
    };
  });
}

async function runStreamText(
  config: AiConfig,
  overrides: AiConnectionOverrides,
  logger: Logger,
  input: AiGenerateTextInput,
): Promise<AiStreamResult> {
  const connection = connectionFor(config, overrides, input);
  prepareChat(connection);
  const prompt = toPrompt(input);
  const meta = metaFor(connection, connection.model);
  const startedAt = Date.now();

  const generated = await runRequest(logger, meta, startedAt, async () =>
    streamText({
      model: createChatModel(connection),
      ...prompt,
      ...sampling(input),
      maxRetries: connection.maxRetries,
      timeout: connection.timeoutMs,
      abortSignal: input.abortSignal,
    }),
  );

  const textStream = generated.textStream;
  const finished = finishStream(generated, meta, startedAt, logger);
  // The caller still observes a rejection on `finished`. This handler only
  // stops an unread stream failure from crashing the process.
  void finished.catch(() => undefined);
  return { textStream, finished };
}

function finishStream(
  generated: {
    text: PromiseLike<string>;
    usage: PromiseLike<{
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    }>;
  },
  meta: AiCallMeta,
  startedAt: number,
  logger: Logger,
): Promise<AiTextResult> {
  return Promise.all([generated.text, generated.usage])
    .then(([text, usage]) => {
      const mapped = toLanguageUsage(usage);
      logSuccess(logger, meta, startedAt, mapped);
      return { ...meta, text, usage: mapped };
    })
    .catch((error: unknown) => {
      if (
        error instanceof AiProviderNotConfiguredError ||
        error instanceof AiRequestError
      ) {
        throw error;
      }
      logFailure(logger, meta, startedAt);
      throw new AiRequestError(meta.provider, meta.model, error);
    });
}

async function runEmbed(
  config: AiConfig,
  overrides: AiConnectionOverrides,
  logger: Logger,
  input: AiEmbedInput,
): Promise<AiEmbedResult> {
  const connection = connectionFor(config, overrides, input);
  prepareEmbedding(connection);
  const meta = metaFor(connection, connection.embeddingModel);
  const startedAt = Date.now();

  return runRequest(logger, meta, startedAt, async () => {
    const generated = await embed({
      model: createEmbeddingModel(connection),
      value: input.value,
      maxRetries: connection.maxRetries,
      abortSignal: abortSignalFor(connection, input.abortSignal),
    });
    const usage = toEmbeddingUsage(generated.usage);
    logSuccess(logger, meta, startedAt, usage);
    return { ...meta, embedding: generated.embedding, usage };
  });
}

async function runEmbedMany(
  config: AiConfig,
  overrides: AiConnectionOverrides,
  logger: Logger,
  input: AiEmbedManyInput,
): Promise<AiEmbedManyResult> {
  const connection = connectionFor(config, overrides, input);
  prepareEmbedding(connection);
  const meta = metaFor(connection, connection.embeddingModel);
  const startedAt = Date.now();

  return runRequest(logger, meta, startedAt, async () => {
    const generated = await embedMany({
      model: createEmbeddingModel(connection),
      values: input.values,
      maxRetries: connection.maxRetries,
      abortSignal: abortSignalFor(connection, input.abortSignal),
    });
    const usage = toEmbeddingUsage(generated.usage);
    logSuccess(logger, meta, startedAt, usage);
    return { ...meta, embeddings: generated.embeddings, usage };
  });
}
