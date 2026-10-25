import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiConfig } from '../config/ai.config.js';
import {
  freeOpenRouterModels,
  isOpenRouterModelId,
  readModelPageDescription,
  type OpenRouterModelChoice,
} from './openrouter-catalog.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class OpenRouterCatalogService {
  private cache: { at: number; models: OpenRouterModelChoice[] } | null = null;
  private pageDescriptions = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {}

  async listFreeModels(): Promise<OpenRouterModelChoice[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.models;
    }
    const models = await this.fetchFreeModels();
    this.cache = { at: Date.now(), models };
    return models;
  }

  async assertFreeModel(modelId: string): Promise<void> {
    const models = await this.listFreeModels();
    if (!models.some((model) => model.id === modelId)) {
      throw new BadRequestException('Choose a free OpenRouter model');
    }
  }

  /**
   * The catalog blurb often ends in "...". This returns the full text from the
   * model page, or the catalog blurb when that page has nothing longer.
   */
  async fullDescription(modelId: string): Promise<string> {
    if (!isOpenRouterModelId(modelId)) {
      throw new BadRequestException('Choose a free OpenRouter model');
    }
    const known = (await this.listFreeModels()).find((model) => model.id === modelId);
    if (!known) {
      throw new BadRequestException('Choose a free OpenRouter model');
    }
    const cached = this.pageDescriptions.get(modelId);
    if (cached !== undefined) return cached;
    const page = await this.fetchPageDescription(modelId);
    const description =
      page && page.length > known.description.length ? page : known.description;
    this.pageDescriptions.set(modelId, description);
    return description;
  }

  private async fetchFreeModels(): Promise<OpenRouterModelChoice[]> {
    const ai = this.configService.getOrThrow<AiConfig>('ai');
    const baseUrl = ai.providers.openrouter.baseUrl.replace(/\/$/, '');
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/models`, {
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Could not load OpenRouter models',
      );
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Could not load OpenRouter models',
      );
    }
    return freeOpenRouterModels(await response.json());
  }

  private async fetchPageDescription(modelId: string): Promise<string | null> {
    const ai = this.configService.getOrThrow<AiConfig>('ai');
    const origin = new URL(ai.providers.openrouter.baseUrl).origin;
    let response: Response;
    try {
      response = await fetch(`${origin}/${modelId}`, {
        headers: { accept: 'text/html' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return null;
    }
    if (!response.ok) return null;
    return readModelPageDescription(await response.text());
  }
}
