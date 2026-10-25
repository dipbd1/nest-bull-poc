import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tables that existed before migrations. `IF NOT EXISTS` lets this run against
 * a database that development `synchronize` already created.
 */
export class InitialSchema1761400000000 implements MigrationInterface {
  name = 'InitialSchema1761400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "emailVerifiedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "registration_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "codeHash" character varying NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_registration_codes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_registration_codes_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" character varying NOT NULL,
        "jobId" character varying NOT NULL,
        "title" character varying NOT NULL,
        "provider" character varying NOT NULL,
        "model" character varying NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_conversations_jobId" UNIQUE ("jobId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversation_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "conversationId" uuid NOT NULL,
        "role" character varying NOT NULL,
        "content" text NOT NULL,
        "sequence" integer NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_conversation_messages_conversation"
          FOREIGN KEY ("conversationId")
          REFERENCES "conversations"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "conversation_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "registration_codes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
