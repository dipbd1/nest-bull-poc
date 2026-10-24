import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { AiConfig } from '../config/ai.config.js';
import { freeOpenRouterModels } from './openrouter-catalog.js';
import { OpenRouterCatalogService } from './openrouter-catalog.service.js';

const config = {
  providers: {
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1' },
  },
} as AiConfig;

describe('freeOpenRouterModels', () => {
  it('keeps models whose prompt and completion prices are zero', () => {
    const models = freeOpenRouterModels({
      data: [
        {
          id: 'paid/model',
          name: 'Paid',
          pricing: { prompt: '0.000001', completion: '0' },
        },
        {
          id: 'vendor/free-model:free',
          name: 'Free model',
          description: 'A small instruct model.',
          context_length: 8192,
          architecture: { input_modalities: ['text'] },
          top_provider: { max_completion_tokens: 2048 },
          benchmarks: {
            artificial_analysis: {
              intelligence_index: 18.5,
              coding_index: null,
              agentic_index: 4,
            },
          },
          pricing: { prompt: '0', completion: '0' },
        },
        {
          id: 'vendor/also-free:free',
          name: 'Also free',
          pricing: { prompt: '0.0', completion: '0' },
        },
        { id: 'missing-price', name: 'Missing', pricing: { prompt: '0' } },
      ],
    });

    expect(models.map((model) => model.id)).toEqual([
      'vendor/also-free:free',
      'vendor/free-model:free',
    ]);
    expect(models[1]).toEqual({
      id: 'vendor/free-model:free',
      name: 'Free model',
      description: 'A small instruct model.',
      contextLength: 8192,
      maxOutputTokens: 2048,
      inputModalities: ['text'],
      intelligenceIndex: 18.5,
      codingIndex: null,
      agenticIndex: 4,
    });
  });

  it('rejects an unrecognized catalog payload', () => {
    expect(() => freeOpenRouterModels({ models: [] })).toThrow(
      'OpenRouter model list was not recognized',
    );
  });
});

describe('OpenRouterCatalogService', () => {
  it('loads the free list once and rejects a model that is not on it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'vendor/free-model:free',
            name: 'Free model',
            pricing: { prompt: '0', completion: '0' },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const moduleRef = await Test.createTestingModule({
      providers: [
        OpenRouterCatalogService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => config },
        },
      ],
    }).compile();
    const catalog = moduleRef.get(OpenRouterCatalogService);

    await expect(catalog.listFreeModels()).resolves.toEqual([
      expect.objectContaining({
        id: 'vendor/free-model:free',
        name: 'Free model',
        description: '',
        contextLength: null,
      }),
    ]);
    await catalog.listFreeModels();
    expect(fetchMock).toHaveBeenCalledOnce();
    await expect(catalog.assertFreeModel('paid/model')).rejects.toThrow(
      'Choose a free OpenRouter model',
    );
    await expect(
      catalog.assertFreeModel('vendor/free-model:free'),
    ).resolves.toBeUndefined();

    vi.unstubAllGlobals();
  });
});
