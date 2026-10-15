import type { ZodType } from 'zod';

export const AI_PROVIDER_NAMES = [
  'openai',
  'anthropic',
  'gemini',
  'openai-compatible',
] as const;

export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

export function isAiProviderName(value: string): value is AiProviderName {
  return (AI_PROVIDER_NAMES as readonly string[]).includes(value);
}

/**
 * Fields that replace the env connection. Later layers win:
 * env, then `create()`, then the individual call.
 */
export interface AiConnectionOverrides {
  provider?: AiProviderName;
  model?: string;
  embeddingModel?: string;
  baseUrl?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  /** Label passed to an OpenAI-compatible client. */
  name?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface AiCallControls {
  abortSignal?: AbortSignal;
}

export interface AiSamplingOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

export type AiContentPart =
  { type: 'text'; text: string } | { type: 'image'; image: string };

export type AiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | AiContentPart[] }
  | { role: 'assistant'; content: string };

export interface AiPromptInput {
  prompt?: string;
  messages?: AiMessage[];
}

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AiCallMeta {
  provider: AiProviderName;
  model: string;
  baseUrl?: string;
  usage: AiUsage;
}

export interface AiTextResult extends AiCallMeta {
  text: string;
}

export type AiSchemaOutput<SCHEMA extends ZodType> =
  SCHEMA extends ZodType<infer Output> ? Output : never;

export interface AiObjectResult<T> extends AiCallMeta {
  object: T;
}

export interface AiStreamResult {
  textStream: AsyncIterable<string>;
  finished: Promise<AiTextResult>;
}

export interface AiEmbedResult extends AiCallMeta {
  embedding: number[];
}

export interface AiEmbedManyResult extends AiCallMeta {
  embeddings: number[][];
}

export interface AiGenerateTextInput
  extends
    AiConnectionOverrides,
    AiCallControls,
    AiSamplingOptions,
    AiPromptInput {}

export interface AiGenerateObjectInput<
  SCHEMA extends ZodType = ZodType,
> extends AiGenerateTextInput {
  schema: SCHEMA;
}

export interface AiEmbedInput extends AiConnectionOverrides, AiCallControls {
  value: string;
}

export interface AiEmbedManyInput
  extends AiConnectionOverrides, AiCallControls {
  values: string[];
}

export interface AiAdapter {
  generateText(input: AiGenerateTextInput): Promise<AiTextResult>;
  generateObject<SCHEMA extends ZodType>(
    input: AiGenerateObjectInput<SCHEMA>,
  ): Promise<AiObjectResult<AiSchemaOutput<SCHEMA>>>;
  streamText(input: AiGenerateTextInput): Promise<AiStreamResult>;
  embed(input: AiEmbedInput): Promise<AiEmbedResult>;
  embedMany(input: AiEmbedManyInput): Promise<AiEmbedManyResult>;
}
