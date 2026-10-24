import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiConfig } from '../config/ai.config.js';
import {
  freeOpenRouterModels,
  type OpenRouterModelChoice,
} from './openrouter-catalog.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class OpenRouterCatalogService {
  private cache: { at: number; models: OpenRouterModelChoice[] } | null = null;

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
}
