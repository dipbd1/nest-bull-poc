import type { AiProviderName } from './ai.types.js';

export class AiProviderNotConfiguredError extends Error {
  readonly provider: AiProviderName;

  constructor(provider: AiProviderName, message: string) {
    super(message);
    this.name = 'AiProviderNotConfiguredError';
    this.provider = provider;
  }
}

export class AiRequestError extends Error {
  readonly provider: AiProviderName;
  readonly model: string;

  constructor(provider: AiProviderName, model: string, cause: unknown) {
    super(`AI request to ${provider} (${model}) failed`, { cause });
    this.name = 'AiRequestError';
    this.provider = provider;
    this.model = model;
  }
}
