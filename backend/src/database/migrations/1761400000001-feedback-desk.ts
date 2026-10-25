import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedbackDesk1761400000001 implements MigrationInterface {
  name = 'FeedbackDesk1761400000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "role" character varying NOT NULL DEFAULT 'reviewer',
        ADD COLUMN IF NOT EXISTS "disabledAt" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "sessionVersion" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "role" character varying NOT NULL,
        "tokenHash" character varying NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "invitedById" uuid,
        "acceptedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invites_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invites_tokenHash" UNIQUE ("tokenHash")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_invites_email" ON "invites" ("email")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actorId" uuid,
        "actorEmail" character varying,
        "action" character varying NOT NULL,
        "targetType" character varying NOT NULL,
        "targetId" character varying,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_events_createdAt" ON "audit_events" ("createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "id" integer NOT NULL,
        "modelAllowlist" text array NOT NULL DEFAULT '{}',
        "retentionDays" integer,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_settings_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feedback_batches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" character varying NOT NULL,
        "model" character varying NOT NULL,
        "tags" text array NOT NULL,
        "createdById" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feedback_batches_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_feedback_batches_createdAt" ON "feedback_batches" ("createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feedback_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "batchId" uuid NOT NULL,
        "position" integer NOT NULL,
        "text" text NOT NULL,
        "suggestedTag" character varying,
        "summary" text,
        "finalTag" character varying,
        "status" character varying NOT NULL DEFAULT 'queued',
        "jobId" character varying,
        "conversationId" uuid,
        "failedReason" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feedback_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feedback_items_batch_position" UNIQUE ("batchId", "position"),
        CONSTRAINT "FK_feedback_items_batch" FOREIGN KEY ("batchId")
          REFERENCES "feedback_batches"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback_batches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "app_settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invites"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "sessionVersion",
        DROP COLUMN IF EXISTS "disabledAt",
        DROP COLUMN IF EXISTS "role"
    `);
  }
}
