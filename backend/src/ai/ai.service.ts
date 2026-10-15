import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ZodType } from 'zod';
import type { AiConfig } from '../config/ai.config.js';
import { createAiAdapter } from './ai.adapter.js';
import type {
  AiAdapter,
  AiConnectionOverrides,
  AiEmbedInput,
  AiEmbedManyInput,
  AiEmbedManyResult,
  AiEmbedResult,
  AiGenerateObjectInput,
  AiGenerateTextInput,
  AiObjectResult,
  AiSchemaOutput,
  AiStreamResult,
  AiTextResult,
} from './ai.types.js';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly configService: ConfigService) {}

  create(overrides: AiConnectionOverrides = {}): AiAdapter {
    return createAiAdapter({
      config: this.config(),
      overrides,
      logger: this.logger,
    });
  }

  generateText(input: AiGenerateTextInput): Promise<AiTextResult> {
    return this.create().generateText(input);
  }

  generateObject<SCHEMA extends ZodType>(
    input: AiGenerateObjectInput<SCHEMA>,
  ): Promise<AiObjectResult<AiSchemaOutput<SCHEMA>>> {
    return this.create().generateObject(input);
  }

  streamText(input: AiGenerateTextInput): Promise<AiStreamResult> {
    return this.create().streamText(input);
  }

  embed(input: AiEmbedInput): Promise<AiEmbedResult> {
    return this.create().embed(input);
  }

  embedMany(input: AiEmbedManyInput): Promise<AiEmbedManyResult> {
    return this.create().embedMany(input);
  }

  private config(): AiConfig {
    return this.configService.getOrThrow<AiConfig>('ai');
  }
}
