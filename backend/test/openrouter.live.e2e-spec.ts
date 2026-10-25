import { NotFoundException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AiModule } from '../src/ai/ai.module.js';
import { AiService } from '../src/ai/ai.service.js';
import { RegistrationCode } from '../src/auth/entities/registration-code.entity.js';
import { User } from '../src/auth/entities/user.entity.js';
import { FeedbackBatch } from '../src/batch/entities/feedback-batch.entity.js';
import { FeedbackItem } from '../src/batch/entities/feedback-item.entity.js';
import { aiConfig } from '../src/config/ai.config.js';
import {
  databaseConfig,
  type DatabaseConfig,
} from '../src/config/database.config.js';
import { ConversationService } from '../src/conversation/conversation.service.js';
import { ConversationMessage } from '../src/conversation/entities/conversation-message.entity.js';
import { Conversation } from '../src/conversation/entities/conversation.entity.js';

const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? '';
const hasLiveKey = apiKey.length > 0;

const SYSTEM_PROMPT = 'You answer in one short sentence.';

function redact(error: unknown): Error {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      parts.push(current.message);
      const extra = current as Error & {
        statusCode?: number;
        responseBody?: unknown;
        cause?: unknown;
      };
      if (extra.statusCode !== undefined) {
        parts.push(`status=${extra.statusCode}`);
      }
      if (typeof extra.responseBody === 'string') {
        parts.push(extra.responseBody.slice(0, 500));
      }
      current = extra.cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  const joined = parts.join(' | ');
  const safe = apiKey ? joined.replaceAll(apiKey, '[redacted]') : joined;
  return new Error(safe);
}

describe.skipIf(!hasLiveKey)('OpenRouter conversation (live)', () => {
  let moduleRef: TestingModule;
  let ai: AiService;
  let conversations: ConversationService;
  const userId = randomUUID();
  const jobId = `live-${randomUUID()}`;
  const userPrompt = 'Reply with one short sentence that includes the word pong.';
  let conversationId: string | undefined;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [aiConfig, databaseConfig],
        }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const database = configService.getOrThrow<DatabaseConfig>('database');
            return {
              type: 'postgres' as const,
              url: database.url,
              ssl: true,
              entities: [
                User,
                RegistrationCode,
                Conversation,
                ConversationMessage,
                FeedbackBatch,
                FeedbackItem,
              ],
              synchronize: true,
              uuidExtension: 'pgcrypto' as const,
              extra: {
                max: 2,
                connectionTimeoutMillis: 10_000,
              },
            };
          },
        }),
        TypeOrmModule.forFeature([
          Conversation,
          ConversationMessage,
          FeedbackItem,
        ]),
        AiModule,
      ],
      providers: [ConversationService],
    }).compile();

    ai = moduleRef.get(AiService);
    conversations = moduleRef.get(ConversationService);
  }, 30_000);

  afterAll(async () => {
    if (conversationId) {
      const messageRepo = moduleRef.get<Repository<ConversationMessage>>(
        getRepositoryToken(ConversationMessage),
      );
      const conversationRepo = moduleRef.get<Repository<Conversation>>(
        getRepositoryToken(Conversation),
      );
      await messageRepo.delete({ conversationId });
      await conversationRepo.delete({ id: conversationId });
    }
    await moduleRef?.close();
  });

  it(
    'stores a model reply and continues the chat',
    async () => {
      let generated: Awaited<ReturnType<AiService['generateText']>>;
      try {
        generated = await ai.generateText({
          provider: 'openrouter',
          model: 'vendor/free-model:free',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        });
      } catch (error) {
        throw redact(error);
      }

      const created = await conversations.createInitial({
        jobId,
        userId,
        title: 'Live ping',
        provider: generated.provider,
        model: 'vendor/free-model:free',
        systemContent: SYSTEM_PROMPT,
        userContent: userPrompt,
        assistantContent: generated.text,
      });
      conversationId = created.id;

      expect(generated.text.trim().length).toBeGreaterThan(0);
      expect(generated.text).not.toContain(apiKey);

      const stored = await conversations.getForUser(created.id, userId);
      expect(stored).toMatchObject({
        title: 'Live ping',
        provider: 'openrouter',
        jobId,
        model: expect.any(String),
      });
      expect(stored.messages.map((message) => message.role)).toEqual([
        'system',
        'user',
        'assistant',
      ]);
      expect(stored.messages[2]?.content).toBe(generated.text);

      const listed = await conversations.listForUser(userId);
      expect(listed).toEqual([
        expect.objectContaining({
          id: created.id,
          preview: generated.text,
        }),
      ]);
      await expect(
        conversations.getForUser(created.id, randomUUID()),
      ).rejects.toBeInstanceOf(NotFoundException);

      let continued: Awaited<ReturnType<ConversationService['addUserMessage']>>;
      try {
        continued = await conversations.addUserMessage(
          created.id,
          userId,
          'Reply with the single word continued.',
        );
      } catch (error) {
        throw redact(error);
      }

      expect(continued.messages.map((message) => message.role)).toEqual([
        'system',
        'user',
        'assistant',
        'user',
        'assistant',
      ]);
      expect(continued.messages[3]?.content).toBe(
        'Reply with the single word continued.',
      );
      expect(continued.messages[4]?.content.trim().length).toBeGreaterThan(0);
      expect(continued.messages[4]?.content).not.toContain(apiKey);
      expect(continued.preview).toBe(continued.messages[4]?.content);
      expect(continued.model).toBe(stored.model);
    },
    120_000,
  );
});
