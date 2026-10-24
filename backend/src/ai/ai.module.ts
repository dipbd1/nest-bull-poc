import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { OpenRouterCatalogService } from './openrouter-catalog.service.js';

@Global()
@Module({
  providers: [AiService, OpenRouterCatalogService],
  exports: [AiService, OpenRouterCatalogService],
})
export class AiModule {}
