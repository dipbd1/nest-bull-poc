import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { APICallError } from 'ai';
import { AiRequestError } from '../ai/ai.errors.js';
import { AiService } from '../ai/ai.service.js';
import { OpenRouterCatalogService } from '../ai/openrouter-catalog.service.js';
import { AuditController } from '../audit/audit.controller.js';
import { AuditService } from '../audit/audit.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { MailService } from '../auth/mail.service.js';
import { jobQueueName } from '../config/queue.config.js';
import { SettingsController } from '../settings/settings.controller.js';
import { UsersController } from '../users/users.controller.js';
import { ConnectionsController } from './connections.controller.js';
import { ConnectionsService } from './connections.service.js';

const SECRET_KEY = 'sk-live-super-secret-value';
const DB_PASSWORD = 'db-password-value';

function aiConfig(apiKey: string) {
  return {
    defaultProvider: 'openai',
    timeoutMs: 60_000,
    maxRetries: 2,
    providers: {
      openai: {
        apiKey: '',
        model: 'gpt-4o-mini',
        embeddingModel: '',
        baseUrl: '',
        name: '',
        headers: {},
      },
      openrouter: {
        apiKey,
        model: 'openai/gpt-4o-mini',
        embeddingModel: '',
        baseUrl: 'https://openrouter.ai/api/v1',
        name: 'openrouter',
        headers: {},
      },
    },
  };
}

describe('ConnectionsService', () => {
  let service: ConnectionsService;
  let apiKey = '';
  const dataSource = { query: vi.fn() };
  const redisClient = { info: vi.fn() };
  const queue = { getBackend: () => ({ client: Promise.resolve(redisClient) }) };
  const mail = { verify: vi.fn() };
  const ai = { generateText: vi.fn() };
  const catalog = { listFreeModels: vi.fn() };
  const audit = { record: vi.fn() };
  const values: Record<string, unknown> = {
    database: { url: `postgres://coder:${DB_PASSWORD}@db.internal:5432/coder` },
    'queue.redis.host': 'redis.internal',
    'queue.redis.port': 6379,
    'queue.redis.password': 'redis-password-value',
    auth: { smtp: { host: 'smtp.internal', port: 25 }, mailFrom: 'coder@example.com' },
  };
  const config = {
    get: vi.fn((key: string) => (key === 'ai' ? aiConfig(apiKey) : values[key])),
    getOrThrow: vi.fn((key: string) => {
      if (key === 'ai') return aiConfig(apiKey);
      throw new Error(`unexpected ${key}`);
    }),
  };

  beforeEach(async () => {
    apiKey = '';
    dataSource.query.mockReset().mockResolvedValue([{ '?column?': 1 }]);
    redisClient.info.mockReset().mockResolvedValue('redis_version:7');
    mail.verify.mockReset().mockResolvedValue(true);
    ai.generateText.mockReset();
    catalog.listFreeModels.mockReset().mockResolvedValue([
      {
        id: 'vendor/free-model:free',
        name: 'Free model',
        description: '',
        contextLength: 8192,
        maxOutputTokens: 2048,
        inputModalities: ['text'],
        outputModalities: ['text'],
        supportsStructuredOutput: true,
        intelligenceIndex: 12,
        codingIndex: null,
        agenticIndex: null,
      },
    ]);
    audit.record.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getQueueToken(jobQueueName), useValue: queue },
        { provide: MailService, useValue: mail },
        { provide: AiService, useValue: ai },
        { provide: OpenRouterCatalogService, useValue: catalog },
        { provide: ConfigService, useValue: config },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(ConnectionsService);
  });

  it('shows a missing model key as not configured, and never echoes secrets', async () => {
    const list = await service.list();

    expect(list.map((view) => [view.tool, view.state])).toEqual([
      ['database', 'connected'],
      ['redis', 'connected'],
      ['model', 'not_configured'],
      ['mail', 'connected'],
      ['identity', 'not_configured'],
    ]);
    expect(list[0].details).toEqual({
      host: 'db.internal',
      port: 5432,
      database: 'coder',
    });
    const body = JSON.stringify(list);
    expect(body).not.toContain(DB_PASSWORD);
    expect(body).not.toContain('redis-password-value');
    expect(ai.generateText).not.toHaveBeenCalled();
  });

  it('tests the model with a fixed prompt and does not return the key', async () => {
    apiKey = SECRET_KEY;
    ai.generateText.mockResolvedValue({ text: 'OK' });

    const view = await service.test('model', actor());

    expect(view.state).toBe('connected');
    expect(view.details).toMatchObject({
      provider: 'openrouter',
      defaultModel: 'vendor/free-model:free',
      apiKeySet: true,
    });
    expect(JSON.stringify(view)).not.toContain(SECRET_KEY);
    expect(ai.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openrouter',
        model: 'vendor/free-model:free',
        prompt: 'Reply with the single word OK.',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'connection.test',
        metadata: { tool: 'model', state: 'connected' },
      }),
    );
  });

  it('drops a provider error message that quotes the key', async () => {
    apiKey = SECRET_KEY;
    ai.generateText.mockRejectedValue(
      new AiRequestError(
        'openrouter',
        'vendor/free-model:free',
        new APICallError({
          message: `Incorrect API key provided: ${SECRET_KEY}`,
          url: 'https://api.openai.com/v1/chat/completions',
          requestBodyValues: {},
          statusCode: 401,
        }),
      ),
    );

    const view = await service.test('model', actor());

    expect(view).toMatchObject({
      state: 'check_failed',
      message: 'Provider rejected the credentials',
    });
    expect(JSON.stringify(view)).not.toContain(SECRET_KEY);
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(SECRET_KEY);
  });

  it('reports a failed database query by driver code only', async () => {
    dataSource.query.mockRejectedValue(
      Object.assign(new Error(`password authentication failed: ${DB_PASSWORD}`), {
        code: '28P01',
      }),
    );

    const view = await service.test('database', actor());

    expect(view).toMatchObject({
      state: 'check_failed',
      message: 'Query failed (28P01)',
    });
    expect(JSON.stringify(view)).not.toContain(DB_PASSWORD);
  });

  it('tests mail by opening a connection without sending', async () => {
    const view = await service.test('mail', actor());
    expect(view.state).toBe('connected');
    expect(mail.verify).toHaveBeenCalled();
  });
});

describe('admin-only routes', () => {
  it.each([
    ['connections', ConnectionsController],
    ['audit', AuditController],
    ['settings', SettingsController],
  ])('/%s requires AuthGuard then AdminGuard', (_name, controller) => {
    expect(Reflect.getMetadata('__guards__', controller)).toEqual([
      AuthGuard,
      AdminGuard,
    ]);
  });

  it('user management routes require AdminGuard, invite accept does not', () => {
    const proto = UsersController.prototype;
    for (const method of ['list', 'listInvites', 'invite', 'update'] as const) {
      expect(Reflect.getMetadata('__guards__', proto[method])).toEqual([
        AuthGuard,
        AdminGuard,
      ]);
    }
    expect(Reflect.getMetadata('__guards__', proto.accept)).toBeUndefined();
  });
});

function actor() {
  return { id: 'admin-1', email: 'admin@example.com' };
}
