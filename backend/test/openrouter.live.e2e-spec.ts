import { NotFoundException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { Job } from 'bullmq';
import { AiModule } from '../src/ai/ai.module.js';
import { RegistrationCode } from '../src/auth/entities/registration-code.entity.js';
import { User } from '../src/auth/entities/user.entity.js';
import { aiConfig } from '../src/config/ai.config.js';
import {
  databaseConfig,
  type DatabaseConfig,
} from '../src/config/database.config.js';
import {
  ConsumerProcessor,
  JOB_SYSTEM_PROMPT,
  jobUserPrompt,
} from '../src/consumer/consumer.processor.js';
import { ConversationService } from '../src/conversation/conversation.service.js';
import { ConversationMessage } from '../src/conversation/entities/conversation-message.entity.js';
import { Conversation } from '../src/conversation/entities/conversation.entity.js';
import type { ProducerJobData } from '../src/producer/producer.service.js';

const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? '';
const hasLiveKey = apiKey.length > 0;

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

describe.skipIf(!hasLiveKey)('OpenRouter job chat (live)', () => {
  let moduleRef: TestingModule;
  let processor: ConsumerProcessor;
  let conversations: ConversationService;
  const userId = randomUUID();
  const jobId = `live-${randomUUID()}`;
  const jobName = 'Live ping';
  const jobDescription = 'Reply with one short sentence that includes the word pong.';
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
              entities: [User, RegistrationCode, Conversation, ConversationMessage],
              synchronize: true,
              uuidExtension: 'pgcrypto' as const,
              extra: {
                max: 2,
                connectionTimeoutMillis: 10_000,
              },
            };
          },
        }),
        TypeOrmModule.forFeature([Conversation, ConversationMessage]),
        AiModule,
      ],
      providers: [ConversationService, ConsumerProcessor],
    }).compile();

    processor = moduleRef.get(ConsumerProcessor);
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
    'processes a job through OpenRouter and continues the stored chat',
    async () => {
      const job = {
        id: jobId,
        data: {
          name: jobName,
          description: jobDescription,
          model: 'vendor/free-model:free',
          userId,
        },
      } as Job<ProducerJobData>;

      let first: { conversationId: string; text: string };
      try {
        first = await processor.process(job);
      } catch (error) {
        throw redact(error);
      }
      conversationId = first.conversationId;

      expect(first.conversationId).toEqual(expect.any(String));
      expect(first.text.trim().length).toBeGreaterThan(0);
      expect(first.text).not.toContain(apiKey);

      const stored = await conversations.getForUser(first.conversationId, userId);
      expect(stored).toMatchObject({
        title: jobName,
        provider: 'openrouter',
        jobId,
        model: expect.any(String),
      });
      expect(stored.model.trim().length).toBeGreaterThan(0);
      expect(stored.messages.map((message) => message.role)).toEqual([
        'system',
        'user',
        'assistant',
      ]);
      expect(stored.messages[0]?.content).toBe(JOB_SYSTEM_PROMPT);
      expect(stored.messages[1]?.content).toBe(
        jobUserPrompt(jobName, jobDescription),
      );
      expect(stored.messages[2]?.content).toBe(first.text);

      const listed = await conversations.listForUser(userId);
      expect(listed).toEqual([
        expect.objectContaining({
          id: first.conversationId,
          preview: first.text,
        }),
      ]);
      await expect(
        conversations.getForUser(first.conversationId, randomUUID()),
      ).rejects.toBeInstanceOf(NotFoundException);

      const replay = await processor.process(job);
      expect(replay).toEqual({
        conversationId: first.conversationId,
        text: first.text,
      });
      const stillOne = await conversations.getForUser(
        first.conversationId,
        userId,
      );
      expect(stillOne.messages).toHaveLength(3);

      let continued: Awaited<ReturnType<ConversationService['addUserMessage']>>;
      try {
        continued = await conversations.addUserMessage(
          first.conversationId,
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
