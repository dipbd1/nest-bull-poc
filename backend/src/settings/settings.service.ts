import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AiProviderName } from '../ai/ai.types.js';
import { AuditService, type AuditActor } from '../audit/audit.service.js';
import type { AiConfig } from '../config/ai.config.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import {
  AppSettings,
  SETTINGS_ROW_ID,
} from './entities/app-settings.entity.js';

export type SettingsView = {
  provider: AiProviderName;
  defaultModel: string;
  modelAllowlist: string[];
  allowedModels: string[];
  retentionDays: number | null;
};

export const MODEL_NOT_ALLOWED_MESSAGE = 'Choose an allowlisted model';

/** An empty allowlist means the connected provider's default model only. */
export function allowedModelsFor(
  allowlist: string[],
  defaultModel: string,
): string[] {
  if (allowlist.length > 0) return allowlist;
  return defaultModel ? [defaultModel] : [];
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSettings)
    private readonly settings: Repository<AppSettings>,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<SettingsView> {
    return this.toView(await this.load());
  }

  async allowedModels(): Promise<string[]> {
    return (await this.get()).allowedModels;
  }

  async isModelAllowed(model: string): Promise<boolean> {
    return (await this.allowedModels()).includes(model);
  }

  async assertModelAllowed(model: string): Promise<void> {
    if (!(await this.isModelAllowed(model))) {
      throw new BadRequestException(MODEL_NOT_ALLOWED_MESSAGE);
    }
  }

  async update(dto: UpdateSettingsDto, actor: AuditActor): Promise<SettingsView> {
    const row = await this.load();
    if (dto.modelAllowlist !== undefined) {
      row.modelAllowlist = [
        ...new Set(dto.modelAllowlist.map((model) => model.trim())),
      ].filter(Boolean);
    }
    if (dto.retentionDays !== undefined) {
      row.retentionDays = dto.retentionDays;
    }
    const saved = await this.settings.save(row);
    await this.audit.record({
      actor,
      action: 'settings.update',
      targetType: 'settings',
      targetId: String(SETTINGS_ROW_ID),
      metadata: {
        modelAllowlist: saved.modelAllowlist,
        retentionDays: saved.retentionDays,
      },
    });
    return this.toView(saved);
  }

  private async load(): Promise<AppSettings> {
    const existing = await this.settings.findOne({
      where: { id: SETTINGS_ROW_ID },
    });
    return (
      existing ??
      this.settings.create({
        id: SETTINGS_ROW_ID,
        modelAllowlist: [],
        retentionDays: null,
      })
    );
  }

  private toView(row: AppSettings): SettingsView {
    const ai = this.config.getOrThrow<AiConfig>('ai');
    const provider = ai.defaultProvider;
    const defaultModel = ai.providers[provider].model;
    const modelAllowlist = row.modelAllowlist ?? [];
    return {
      provider,
      defaultModel,
      modelAllowlist,
      allowedModels: allowedModelsFor(modelAllowlist, defaultModel),
      retentionDays: row.retentionDays,
    };
  }
}
