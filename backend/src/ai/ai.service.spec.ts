import { Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { z } from 'zod';
import { aiConfig, type AiConfig } from '../config/ai.config.js';
import { validateEnv } from '../config/queue.config.js';
import { AiProviderNotConfiguredError, AiRequestError } from './ai.errors.js';
import { AiModule } from './ai.module.js';
import { AiService } from './ai.service.js';

const {
  generateText,
  streamText,
  embed,
  embedMany,
  outputObject,
  createOpenAI,
  createAnthropic,
  createGoogleGenerativeAI,
  createOpenAICompatible,
} = vi.hoisted(() => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
  embed: vi.fn(),
  embedMany: vi.fn(),
  outputObject: vi.fn(),
  createOpenAI: vi.fn(),
  createAnthropic: vi.fn(),
  createGoogleGenerativeAI: vi.fn(),
  createOpenAICompatible: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText,
  streamText,
  embed,
  embedMany,
  Output: { object: outputObject },
}));

vi.mock('@ai-sdk/openai', () => ({ createOpenAI }));
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic }));
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI }));
vi.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible }));

const AI_ENV_KEYS = [
  'AI_DEFAULT_PROVIDER',
  'AI_TIMEOUT_MS',
  'AI_MAX_RETRIES',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_EMBEDDING_MODEL',
  'OPENAI_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_BASE_URL',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_EMBEDDING_MODEL',
  'GEMINI_BASE_URL',
  'OPENAI_COMPATIBLE_API_KEY',
  'OPENAI_COMPATIBLE_MODEL',
  'OPENAI_COMPATIBLE_EMBEDDING_MODEL',
  'OPENAI_COMPATIBLE_BASE_URL',
  'OPENAI_COMPATIBLE_NAME',
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
  'OPENROUTER_EMBEDDING_MODEL',
  'OPENROUTER_BASE_URL',
  'OPENROUTER_SITE_URL',
  'OPENROUTER_APP_NAME',
] as const;

const languageUsage = {
  inputTokens: 10,
  outputTokens: 5,
  totalTokens: 15,
};

const baseConfig: AiConfig = {
  defaultProvider: 'openai',
  timeoutMs: 60000,
  maxRetries: 2,
  providers: {
    openai: {
      apiKey: 'sk-openai',
      model: 'gpt-4o-mini',
      embeddingModel: 'text-embedding-3-small',
      baseUrl: '',
      name: '',
      headers: {},
    },
    anthropic: {
      apiKey: 'sk-anthropic',
      model: 'claude-sonnet-4-5',
      embeddingModel: '',
      baseUrl: '',
      name: '',
      headers: {},
    },
    gemini: {
      apiKey: 'gk-gemini',
      model: 'gemini-2.5-flash',
      embeddingModel: 'gemini-embedding-001',
      baseUrl: '',
      name: '',
      headers: {},
    },
    'openai-compatible': {
      apiKey: '',
      model: '',
      embeddingModel: '',
      baseUrl: '',
      name: 'openai-compatible',
      headers: {},
    },
    openrouter: {
      apiKey: 'sk-or',
      model: 'openai/gpt-4o-mini',
      embeddingModel: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      name: 'openrouter',
      headers: {},
    },
  },
};

interface MockProvider {
  mock: { calls: unknown[][] };
  embedding: { mock: { calls: unknown[][] } };
  embeddingModel: { mock: { calls: unknown[][] } };
}

function mockProvider(): MockProvider {
  const chat = vi.fn((modelId: string) => ({ modelId }));
  const embedding = vi.fn((modelId: string) => ({
    modelId,
    embedding: true,
  }));
  return Object.assign(chat, { embedding, embeddingModel: embedding });
}

function providerAt(
  factory: { mock: { results: Array<{ value?: unknown }> } },
  index = 0,
): MockProvider {
  const value = factory.mock.results[index]?.value;
  if (!value) throw new Error('provider factory was not called');
  return value as MockProvider;
}

function loggedText(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.map((call) => String(call[0])).join('\n');
}

function withAiEnv(
  values: Record<string, string | undefined>,
  run: () => void,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function clearedAiEnv(): Record<string, undefined> {
  return Object.fromEntries(AI_ENV_KEYS.map((key) => [key, undefined]));
}

async function createService(
  config: AiConfig = baseConfig,
): Promise<AiService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      AiService,
      {
        provide: ConfigService,
        useValue: {
          getOrThrow: (key: string) => {
            if (key === 'ai') return config;
            throw new Error(`Unexpected config key ${key}`);
          },
        },
      },
    ],
  }).compile();

  return moduleRef.get(AiService);
}

describe('aiConfig', () => {
  it('uses built-in defaults when AI env vars are empty', () => {
    withAiEnv(clearedAiEnv(), () => {
      const config = aiConfig();
      expect(config.defaultProvider).toBe('openai');
      expect(config.timeoutMs).toBe(60000);
      expect(config.maxRetries).toBe(2);
      expect(config.providers.openai).toMatchObject({
        apiKey: '',
        model: 'gpt-4o-mini',
        embeddingModel: 'text-embedding-3-small',
        baseUrl: '',
      });
      expect(config.providers.anthropic).toMatchObject({
        apiKey: '',
        model: 'claude-sonnet-4-5',
        embeddingModel: '',
        baseUrl: '',
      });
      expect(config.providers.gemini).toMatchObject({
        apiKey: '',
        model: 'gemini-2.5-flash',
        embeddingModel: 'gemini-embedding-001',
        baseUrl: '',
      });
      expect(config.providers['openai-compatible']).toEqual({
        apiKey: '',
        model: '',
        embeddingModel: '',
        baseUrl: '',
        name: 'openai-compatible',
        headers: {},
      });
      expect(config.providers.openrouter).toEqual({
        apiKey: '',
        model: 'openai/gpt-4o-mini',
        embeddingModel: '',
        baseUrl: 'https://openrouter.ai/api/v1',
        name: 'openrouter',
        headers: {},
      });
    });
  });

  it('reads provider, models, keys, timeout, and retries from the environment', () => {
    withAiEnv(
      {
        ...clearedAiEnv(),
        AI_DEFAULT_PROVIDER: 'gemini',
        AI_TIMEOUT_MS: '1500',
        AI_MAX_RETRIES: '4',
        OPENAI_API_KEY: 'sk-from-env',
        OPENAI_MODEL: 'gpt-4.1-mini',
        OPENAI_EMBEDDING_MODEL: 'text-embedding-3-large',
        OPENAI_BASE_URL: 'https://proxy.example/v1',
        ANTHROPIC_API_KEY: 'sk-anthropic-env',
        ANTHROPIC_MODEL: 'claude-test',
        GOOGLE_GENERATIVE_AI_API_KEY: 'gk-from-env',
        GEMINI_MODEL: 'gemini-test',
        GEMINI_EMBEDDING_MODEL: 'gemini-embed-test',
        OPENAI_COMPATIBLE_BASE_URL: 'http://127.0.0.1:11434/v1',
        OPENAI_COMPATIBLE_MODEL: 'llama3.1',
        OPENAI_COMPATIBLE_EMBEDDING_MODEL: 'nomic-embed-text',
        OPENAI_COMPATIBLE_NAME: 'ollama',
        OPENROUTER_API_KEY: 'sk-or-env',
        OPENROUTER_MODEL: 'anthropic/claude-sonnet-4.5',
        OPENROUTER_EMBEDDING_MODEL: 'openai/text-embedding-3-small',
        OPENROUTER_BASE_URL: 'https://openrouter.example/v1',
        OPENROUTER_SITE_URL: 'https://app.example',
        OPENROUTER_APP_NAME: 'queue-console',
      },
      () => {
        const config = aiConfig();
        expect(config.defaultProvider).toBe('gemini');
        expect(config.timeoutMs).toBe(1500);
        expect(config.maxRetries).toBe(4);
        expect(config.providers.openai).toMatchObject({
          apiKey: 'sk-from-env',
          model: 'gpt-4.1-mini',
          embeddingModel: 'text-embedding-3-large',
          baseUrl: 'https://proxy.example/v1',
        });
        expect(config.providers.anthropic.apiKey).toBe('sk-anthropic-env');
        expect(config.providers.anthropic.model).toBe('claude-test');
        expect(config.providers.gemini.apiKey).toBe('gk-from-env');
        expect(config.providers.gemini.model).toBe('gemini-test');
        expect(config.providers.gemini.embeddingModel).toBe(
          'gemini-embed-test',
        );
        expect(config.providers['openai-compatible']).toMatchObject({
          baseUrl: 'http://127.0.0.1:11434/v1',
          model: 'llama3.1',
          embeddingModel: 'nomic-embed-text',
          name: 'ollama',
        });
        expect(config.providers.openrouter).toMatchObject({
          apiKey: 'sk-or-env',
          model: 'anthropic/claude-sonnet-4.5',
          embeddingModel: 'openai/text-embedding-3-small',
          baseUrl: 'https://openrouter.example/v1',
          name: 'openrouter',
          headers: {
            'HTTP-Referer': 'https://app.example',
            'X-Title': 'queue-console',
          },
        });
      },
    );
  });
});

describe('validateEnv', () => {
  it('allows empty AI settings and a known provider', () => {
    expect(validateEnv({ DATABASE_URL: 'postgres://localhost/test' })).toEqual({
      DATABASE_URL: 'postgres://localhost/test',
    });
    expect(
      validateEnv({
        DATABASE_URL: 'postgres://localhost/test',
        AI_DEFAULT_PROVIDER: '',
        AI_TIMEOUT_MS: '',
        AI_MAX_RETRIES: '',
        OPENAI_API_KEY: '',
      }),
    ).toMatchObject({ OPENAI_API_KEY: '' });
    expect(
      validateEnv({
        DATABASE_URL: 'postgres://localhost/test',
        AI_DEFAULT_PROVIDER: ' gemini ',
        AI_TIMEOUT_MS: '1500',
        AI_MAX_RETRIES: 0,
      }),
    ).toMatchObject({ AI_DEFAULT_PROVIDER: ' gemini ' });
  });

  it('rejects an unknown AI_DEFAULT_PROVIDER', () => {
    expect(() => validateEnv({ AI_DEFAULT_PROVIDER: 'azure' })).toThrow(
      'AI_DEFAULT_PROVIDER must be one of: openai, anthropic, gemini, openai-compatible, openrouter',
    );
  });

  it('rejects a non-numeric timeout or retry count', () => {
    expect(() => validateEnv({ AI_TIMEOUT_MS: 'soon' })).toThrow(
      'AI_TIMEOUT_MS must be a number',
    );
    expect(() => validateEnv({ AI_MAX_RETRIES: 'many' })).toThrow(
      'AI_MAX_RETRIES must be a number',
    );
  });

  it('still rejects a non-numeric REDIS_PORT', () => {
    expect(() => validateEnv({ REDIS_PORT: 'nope' })).toThrow(
      'REDIS_PORT must be a number',
    );
  });
});

describe('AiService', () => {
  let service: AiService;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    generateText.mockReset();
    generateText.mockResolvedValue({
      text: 'hello',
      output: { label: 'bug', summary: 'broken' },
      usage: languageUsage,
    });
    streamText.mockReset();
    streamText.mockImplementation(() => ({
      textStream: (async function* () {
        yield 'hel';
        yield 'lo';
      })(),
      text: Promise.resolve('hello'),
      usage: Promise.resolve(languageUsage),
    }));
    embed.mockReset();
    embed.mockResolvedValue({
      embedding: [0.1, 0.2],
      usage: { tokens: 4 },
    });
    embedMany.mockReset();
    embedMany.mockResolvedValue({
      embeddings: [[0.1], [0.2]],
      usage: { tokens: 8 },
    });
    outputObject.mockReset();
    outputObject.mockImplementation((options: unknown) => ({ options }));

    for (const factory of [
      createOpenAI,
      createAnthropic,
      createGoogleGenerativeAI,
      createOpenAICompatible,
    ]) {
      factory.mockReset();
      factory.mockImplementation(() => mockProvider());
    }

    logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    service = await createService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses env provider, model, timeout, and retries', async () => {
    const signal = new AbortController().signal;
    const result = await service.generateText({
      prompt: 'hello',
      abortSignal: signal,
      temperature: 0.2,
      maxOutputTokens: 128,
    });

    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: 'sk-openai' });
    expect(providerAt(createOpenAI).mock.calls[0]?.[0]).toBe('gpt-4o-mini');
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'hello',
        timeout: 60000,
        maxRetries: 2,
        abortSignal: signal,
        temperature: 0.2,
        maxOutputTokens: 128,
        model: { modelId: 'gpt-4o-mini' },
      }),
    );
    expect(result).toMatchObject({
      text: 'hello',
      provider: 'openai',
      model: 'gpt-4o-mini',
      usage: languageUsage,
    });
    expect(result.baseUrl).toBeUndefined();

    const logged = loggedText(logSpy);
    expect(logged).toContain('provider=openai');
    expect(logged).toContain('model=gpt-4o-mini');
    expect(logged).toContain('durationMs=');
    expect(logged).toContain('"inputTokens":10');
    expect(logged).toContain('"outputTokens":5');
    expect(logged).toContain('"totalTokens":15');
    expect(logged).not.toContain('sk-openai');
  });

  it('uses a call-site provider and model', async () => {
    const result = await service.generateText({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      prompt: 'job text',
    });

    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: 'gk-gemini',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    });
    expect(providerAt(createGoogleGenerativeAI).mock.calls[0]?.[0]).toBe(
      'gemini-2.5-flash',
    );
    expect(createOpenAI).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      text: 'hello',
    });
  });

  it('sends a user image URL to the model', async () => {
    await service.generateText({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this picture?' },
            { type: 'image', image: 'https://example.com/cat.png' },
          ],
        },
      ],
    });

    const call = generateText.mock.calls[0]?.[0] as {
      messages: Array<{
        role: string;
        content: Array<{ type: string; text?: string; image?: URL }>;
      }>;
      prompt?: string;
    };
    expect(call.prompt).toBeUndefined();
    expect(call.messages[0]?.role).toBe('user');
    expect(call.messages[0]?.content[0]).toEqual({
      type: 'text',
      text: 'What is in this picture?',
    });
    expect(call.messages[0]?.content[1]?.image).toBeInstanceOf(URL);
    expect(call.messages[0]?.content[1]?.image?.href).toBe(
      'https://example.com/cat.png',
    );
  });

  it('connects to OpenRouter with configured headers', async () => {
    const routed = await createService({
      ...baseConfig,
      providers: {
        ...baseConfig.providers,
        openrouter: {
          ...baseConfig.providers.openrouter,
          headers: {
            'HTTP-Referer': 'https://app.example',
            'X-Title': 'queue-console',
          },
        },
      },
    });

    const result = await routed.generateText({
      provider: 'openrouter',
      prompt: 'job text',
    });

    expect(createOpenAICompatible).toHaveBeenCalledWith({
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or',
      headers: {
        'HTTP-Referer': 'https://app.example',
        'X-Title': 'queue-console',
      },
    });
    expect(providerAt(createOpenAICompatible).mock.calls[0]?.[0]).toBe(
      'openai/gpt-4o-mini',
    );
    expect(createOpenAI).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      baseUrl: 'https://openrouter.ai/api/v1',
      text: 'hello',
    });
  });

  it('lets a call replace OpenRouter headers', async () => {
    const routed = await createService({
      ...baseConfig,
      providers: {
        ...baseConfig.providers,
        openrouter: {
          ...baseConfig.providers.openrouter,
          headers: { 'X-Title': 'from-env' },
        },
      },
    });

    await routed.generateText({
      provider: 'openrouter',
      headers: { 'X-Title': 'override' },
      prompt: 'hi',
    });

    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'X-Title': 'override' } }),
    );
  });

  it('connects to a local OpenAI-compatible server', async () => {
    const local = service.create({
      provider: 'openai-compatible',
      model: 'llama3.1',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: 'ollama',
      headers: { 'X-Local': '1' },
      name: 'ollama',
    });

    const result = await local.generateText({ prompt: 'summarize' });

    expect(createOpenAICompatible).toHaveBeenCalledWith({
      name: 'ollama',
      baseURL: 'http://127.0.0.1:11434/v1',
      apiKey: 'ollama',
      headers: { 'X-Local': '1' },
    });
    expect(providerAt(createOpenAICompatible).mock.calls[0]?.[0]).toBe(
      'llama3.1',
    );
    expect(createOpenAI).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      provider: 'openai-compatible',
      model: 'llama3.1',
      baseUrl: 'http://127.0.0.1:11434/v1',
      text: 'hello',
    });
  });

  it('applies a per-call override without changing the adapter', async () => {
    const adapter = service.create({
      model: 'gpt-4o-mini',
      timeoutMs: 5000,
    });

    await adapter.generateText({
      model: 'gpt-4o',
      timeoutMs: 1500,
      prompt: 'a',
    });
    await adapter.generateText({ prompt: 'b' });

    expect(providerAt(createOpenAI, 0).mock.calls[0]?.[0]).toBe('gpt-4o');
    expect(providerAt(createOpenAI, 1).mock.calls[0]?.[0]).toBe('gpt-4o-mini');
    expect(generateText).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ prompt: 'a', timeout: 1500, maxRetries: 2 }),
    );
    expect(generateText).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ prompt: 'b', timeout: 5000, maxRetries: 2 }),
    );
  });

  it('generates an object from a Zod schema', async () => {
    const schema = z.object({
      label: z.enum(['bug', 'feature']),
      summary: z.string(),
    });
    const outputSpec = { kind: 'object' };
    outputObject.mockReturnValue(outputSpec);

    const decision = await service.generateObject({
      schema,
      prompt: 'job text',
    });

    expect(outputObject).toHaveBeenCalledWith({ schema });
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        output: outputSpec,
        prompt: 'job text',
      }),
    );
    expect(decision.object).toEqual({ label: 'bug', summary: 'broken' });
    expect(decision.object.label).toBe('bug');
    expect(decision.provider).toBe('openai');
    expect(decision.usage).toEqual(languageUsage);
  });

  it('streams text pieces and resolves the full result', async () => {
    const stream = await service.streamText({ prompt: 'hi' });
    const parts: string[] = [];
    for await (const part of stream.textStream) parts.push(part);
    const finished = await stream.finished;

    expect(parts).toEqual(['hel', 'lo']);
    expect(finished).toMatchObject({
      text: 'hello',
      provider: 'openai',
      model: 'gpt-4o-mini',
      usage: languageUsage,
    });
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'hi',
        timeout: 60000,
        maxRetries: 2,
      }),
    );
    expect(loggedText(logSpy)).toContain('usage=');
    expect(loggedText(logSpy)).not.toContain('sk-openai');
  });

  it('rejects the finished promise when streaming fails', async () => {
    const cause = new Error('stream broke sk-openai');
    streamText.mockReturnValueOnce({
      textStream: (async function* () {
        yield 'partial';
      })(),
      text: Promise.reject(cause),
      usage: Promise.resolve(languageUsage),
    });

    const stream = await service.streamText({ prompt: 'hi' });

    await expect(stream.finished).rejects.toBeInstanceOf(AiRequestError);
    await expect(stream.finished).rejects.toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini',
      cause,
    });
    expect(loggedText(errorSpy)).not.toContain('sk-openai');
  });

  it('embeds with the embedding model, not the chat model', async () => {
    const one = await service.embed({ value: 'hello' });
    const many = await service.embedMany({
      values: ['a', 'b'],
      embeddingModel: 'text-embedding-3-large',
    });

    expect(one).toMatchObject({
      embedding: [0.1, 0.2],
      provider: 'openai',
      model: 'text-embedding-3-small',
      usage: { totalTokens: 4 },
    });
    expect(many).toMatchObject({
      embeddings: [[0.1], [0.2]],
      model: 'text-embedding-3-large',
      usage: { totalTokens: 8 },
    });
    expect(providerAt(createOpenAI, 0).mock.calls).toHaveLength(0);
    expect(providerAt(createOpenAI, 0).embedding.mock.calls[0]?.[0]).toBe(
      'text-embedding-3-small',
    );
    expect(providerAt(createOpenAI, 1).embedding.mock.calls[0]?.[0]).toBe(
      'text-embedding-3-large',
    );
    expect(embed).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'hello',
        maxRetries: 2,
        abortSignal: expect.any(AbortSignal),
      }),
    );
    expect(embedMany).toHaveBeenCalledWith(
      expect.objectContaining({ values: ['a', 'b'], maxRetries: 2 }),
    );

    await service.embed({ provider: 'gemini', value: 'hello' });
    expect(
      providerAt(createGoogleGenerativeAI).embedding.mock.calls[0]?.[0],
    ).toBe('gemini-embedding-001');

    const local = service.create({
      provider: 'openai-compatible',
      model: 'llama3.1',
      embeddingModel: 'nomic-embed-text',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: 'ollama',
    });
    const embedded = await local.embed({ value: 'hello' });
    expect(embedded.model).toBe('nomic-embed-text');
    const compatible = providerAt(createOpenAICompatible);
    expect(compatible.mock.calls).toHaveLength(0);
    expect(compatible.embeddingModel.mock.calls[0]?.[0]).toBe(
      'nomic-embed-text',
    );
  });

  it('rejects Anthropic embeddings', async () => {
    await expect(
      service.embed({ provider: 'anthropic', value: 'hello' }),
    ).rejects.toBeInstanceOf(AiProviderNotConfiguredError);
    await expect(
      service.embed({ provider: 'anthropic', value: 'hello' }),
    ).rejects.toThrow('Anthropic does not support embeddings');
    await expect(
      service.embedMany({ provider: 'anthropic', values: ['hello'] }),
    ).rejects.toThrow('Anthropic does not support embeddings');
    expect(createAnthropic).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
    expect(embedMany).not.toHaveBeenCalled();
  });

  it('rejects a missing embedding model before calling the SDK', async () => {
    const bare = await createService({
      ...baseConfig,
      providers: {
        ...baseConfig.providers,
        openai: { ...baseConfig.providers.openai, embeddingModel: '' },
      },
    });

    await expect(bare.embed({ value: 'hello' })).rejects.toThrow(
      'Embedding model is not configured for openai',
    );
    expect(embed).not.toHaveBeenCalled();
    expect(createOpenAI).not.toHaveBeenCalled();
  });

  it('rejects a missing official API key on the call', async () => {
    const bare = await createService({
      ...baseConfig,
      providers: {
        ...baseConfig.providers,
        openai: { ...baseConfig.providers.openai, apiKey: '' },
      },
    });
    const adapter = bare.create();

    expect(createOpenAI).not.toHaveBeenCalled();
    await expect(adapter.generateText({ prompt: 'hi' })).rejects.toMatchObject({
      name: 'AiProviderNotConfiguredError',
      provider: 'openai',
    });
    await expect(adapter.generateText({ prompt: 'hi' })).rejects.toThrow(
      'API key is not configured for openai',
    );
    expect(createOpenAI).not.toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
  });

  it('rejects a missing OpenRouter API key', async () => {
    const bare = await createService({
      ...baseConfig,
      providers: {
        ...baseConfig.providers,
        openrouter: { ...baseConfig.providers.openrouter, apiKey: '' },
      },
    });

    await expect(
      bare.generateText({ provider: 'openrouter', prompt: 'hi' }),
    ).rejects.toMatchObject({
      name: 'AiProviderNotConfiguredError',
      provider: 'openrouter',
    });
    await expect(
      bare.generateText({ provider: 'openrouter', prompt: 'hi' }),
    ).rejects.toThrow('API key is not configured for openrouter');
    expect(createOpenAICompatible).not.toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
  });

  it('rejects a missing OpenAI-compatible base URL', async () => {
    const local = service.create({
      provider: 'openai-compatible',
      model: 'llama3.1',
    });

    await expect(local.generateText({ prompt: 'hi' })).rejects.toBeInstanceOf(
      AiProviderNotConfiguredError,
    );
    await expect(local.generateText({ prompt: 'hi' })).rejects.toThrow(
      'Base URL is not configured for openai-compatible',
    );
    expect(createOpenAICompatible).not.toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
  });

  it('wraps vendor failures without logging the API key', async () => {
    const cause = new Error('unauthorized sk-openai');
    generateText.mockRejectedValue(cause);

    const error = await service
      .generateText({ prompt: 'hi' })
      .then(() => undefined)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiRequestError);
    expect(error).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini',
      cause,
    });

    const logged = loggedText(errorSpy);
    expect(logged).toContain('provider=openai');
    expect(logged).toContain('model=gpt-4o-mini');
    expect(logged).toContain('durationMs=');
    expect(logged).toContain('failed');
    expect(logged).not.toContain('sk-openai');
    expect(loggedText(logSpy)).not.toContain('sk-openai');
  });

  it('boots with empty keys and fails on the call that needs them', async () => {
    const previous = new Map<string, string | undefined>();
    for (const key of AI_ENV_KEYS) {
      previous.set(key, process.env[key]);
      delete process.env[key];
    }

    let moduleRef: TestingModule | undefined;
    try {
      moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [aiConfig],
            validate: validateEnv,
          }),
          AiModule,
        ],
      }).compile();
      const ai = moduleRef.get(AiService);
      const adapter = ai.create();

      await expect(adapter.generateText({ prompt: 'hi' })).rejects.toThrow(
        'API key is not configured for openai',
      );
      expect(createOpenAI).not.toHaveBeenCalled();
    } finally {
      await moduleRef?.close();
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
