import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { AiService } from '../ai/ai.service.js';
import { suggestedFreeModel } from '../ai/openrouter-catalog.js';
import { OpenRouterCatalogService } from '../ai/openrouter-catalog.service.js';
import { AuditService, type AuditActor } from '../audit/audit.service.js';
import { MailService } from '../auth/mail.service.js';
import type { AiConfig } from '../config/ai.config.js';
import type { AuthConfig } from '../config/auth.config.js';
import type { DatabaseConfig } from '../config/database.config.js';
import { jobQueueName } from '../config/queue.config.js';
import {
  describeError,
  describeModelError,
  publicBaseUrl,
  publicUrlParts,
  withTimeout,
} from './connections.redact.js';
import type {
  ConnectionState,
  ConnectionTool,
  ConnectionView,
} from './connections.types.js';

const CHECK_TIMEOUT_MS = 5_000;
const MODEL_CHECK_TIMEOUT_MS = 15_000;

type CheckResult = { state: ConnectionState; message: string | null };

const CONNECTED: CheckResult = { state: 'connected', message: null };

const LABELS: Record<ConnectionTool, string> = {
  database: 'Database',
  redis: 'Queue',
  model: 'Model',
  mail: 'Mail',
  identity: 'Company login',
};

@Injectable()
export class ConnectionsService {
  /** Model and identity checks call a remote service, so GET reuses the last result. */
  private readonly lastChecks = new Map<
    ConnectionTool,
    CheckResult & { checkedAt: string }
  >();

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectQueue(jobQueueName)
    private readonly queue: Queue,
    private readonly mail: MailService,
    private readonly ai: AiService,
    private readonly catalog: OpenRouterCatalogService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<ConnectionView[]> {
    return Promise.all([
      this.run('database'),
      this.run('redis'),
      this.viewFromLastCheck('model'),
      this.run('mail'),
      this.viewFromLastCheck('identity'),
    ]);
  }

  async test(tool: ConnectionTool, actor: AuditActor): Promise<ConnectionView> {
    const view = await this.run(tool);
    await this.audit.record({
      actor,
      action: 'connection.test',
      targetType: 'connection',
      targetId: tool,
      metadata: { tool, state: view.state },
    });
    return view;
  }

  private async run(tool: ConnectionTool): Promise<ConnectionView> {
    const result = await this.check(tool);
    const checkedAt = new Date().toISOString();
    this.lastChecks.set(tool, { ...result, checkedAt });
    return {
      tool,
      label: LABELS[tool],
      ...result,
      details: await this.details(tool),
      checkedAt,
    };
  }

  private async viewFromLastCheck(tool: ConnectionTool): Promise<ConnectionView> {
    const configured = await this.isConfigured(tool);
    const last = this.lastChecks.get(tool);
    const result: CheckResult = !configured
      ? { state: 'not_configured', message: this.notConfiguredMessage(tool) }
      : last
        ? { state: last.state, message: last.message }
        : CONNECTED;
    return {
      tool,
      label: LABELS[tool],
      ...result,
      details: await this.details(tool),
      checkedAt: configured ? (last?.checkedAt ?? null) : null,
    };
  }

  private async check(tool: ConnectionTool): Promise<CheckResult> {
    if (!(await this.isConfigured(tool))) {
      return { state: 'not_configured', message: this.notConfiguredMessage(tool) };
    }
    switch (tool) {
      case 'database':
        return this.attempt(
          () => this.dataSource.query('SELECT 1'),
          'Query failed',
        );
      case 'redis':
        return this.attempt(async () => {
          const client = await this.queue.getBackend().client;
          await client.info();
        }, 'Redis did not answer');
      case 'mail':
        return this.attempt(() => this.mail.verify(), 'SMTP handshake failed');
      case 'model':
        return this.checkModel();
      case 'identity':
        return this.attempt(async () => {
          const issuer = this.env('OIDC_ISSUER').replace(/\/$/, '');
          const response = await fetch(
            `${issuer}/.well-known/openid-configuration`,
            { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) },
          );
          if (!response.ok) {
            throw Object.assign(new Error('discovery failed'), {
              code: `HTTP_${response.status}`,
            });
          }
        }, 'Discovery document unavailable');
    }
  }

  private async attempt(
    operation: () => Promise<unknown>,
    fallback: string,
  ): Promise<CheckResult> {
    try {
      await withTimeout(operation(), CHECK_TIMEOUT_MS);
      return CONNECTED;
    } catch (error) {
      return { state: 'check_failed', message: describeError(error, fallback) };
    }
  }

  /** Sends a fixed one-word prompt. No customer comment leaves the server. */
  private async checkModel(): Promise<CheckResult> {
    try {
      const openrouter = this.aiConfig().providers.openrouter;
      const models = await this.catalog.listFreeModels();
      const model = suggestedFreeModel(models, openrouter.model);
      if (!model) {
        return { state: 'check_failed', message: 'Could not load OpenRouter models' };
      }
      await withTimeout(
        this.ai.generateText({
          provider: 'openrouter',
          model,
          prompt: 'Reply with the single word OK.',
          maxOutputTokens: 16,
          maxRetries: 0,
          timeoutMs: MODEL_CHECK_TIMEOUT_MS,
        }),
        MODEL_CHECK_TIMEOUT_MS + 1_000,
      );
      return CONNECTED;
    } catch (error) {
      return { state: 'check_failed', message: describeModelError(error) };
    }
  }

  private async isConfigured(tool: ConnectionTool): Promise<boolean> {
    switch (tool) {
      case 'database':
        return Boolean(this.config.get<DatabaseConfig>('database')?.url);
      case 'redis':
        return Boolean(this.config.get<string>('queue.redis.host'));
      case 'mail':
        return Boolean(this.config.get<AuthConfig>('auth')?.smtp.host);
      case 'model':
        return Boolean(this.aiConfig().providers.openrouter.apiKey);
      case 'identity':
        return ['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'].every(
          (key) => Boolean(this.env(key)),
        );
    }
  }

  private notConfiguredMessage(tool: ConnectionTool): string {
    switch (tool) {
      case 'database':
        return 'Set DATABASE_URL';
      case 'redis':
        return 'Set REDIS_HOST';
      case 'mail':
        return 'Set SMTP_HOST';
      case 'model':
        return 'Set OPENROUTER_API_KEY';
      case 'identity':
        return 'Set OIDC_ISSUER, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET';
    }
  }

  private async details(tool: ConnectionTool): Promise<ConnectionView['details']> {
    switch (tool) {
      case 'database': {
        const url = this.config.get<DatabaseConfig>('database')?.url ?? '';
        const parts = publicUrlParts(url);
        return {
          host: parts.host,
          port: parts.port,
          database: parts.path?.replace(/^\//, '') ?? null,
        };
      }
      case 'redis':
        return {
          host: this.config.get<string>('queue.redis.host') ?? null,
          port: this.config.get<number>('queue.redis.port') ?? null,
          tls: Boolean(this.config.get<boolean>('queue.redis.tls')),
          authentication: Boolean(this.config.get<string>('queue.redis.password')),
          queue: jobQueueName,
        };
      case 'mail': {
        const auth = this.config.get<AuthConfig>('auth');
        return {
          host: auth?.smtp.host ?? null,
          port: auth?.smtp.port ?? null,
          from: auth?.mailFrom ?? null,
        };
      }
      case 'model': {
        const openrouter = this.aiConfig().providers.openrouter;
        let defaultModel: string | null = openrouter.model || null;
        try {
          const models = await this.catalog.listFreeModels();
          defaultModel = suggestedFreeModel(models, openrouter.model) || null;
        } catch {
          // The key and base URL are still worth showing when the catalog is down.
        }
        return {
          provider: 'openrouter',
          defaultModel,
          baseUrl: publicBaseUrl(openrouter.baseUrl),
          apiKeySet: Boolean(openrouter.apiKey),
        };
      }
      case 'identity': {
        const issuer = this.env('OIDC_ISSUER');
        return {
          issuer: publicBaseUrl(issuer),
          clientIdSet: Boolean(this.env('OIDC_CLIENT_ID')),
          clientSecretSet: Boolean(this.env('OIDC_CLIENT_SECRET')),
        };
      }
    }
  }

  private aiConfig(): AiConfig {
    return this.config.getOrThrow<AiConfig>('ai');
  }

  private env(key: string): string {
    return this.config.get<string>(key)?.trim() ?? '';
  }
}
