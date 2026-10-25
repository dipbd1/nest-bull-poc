import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { FeedbackBatch } from './feedback-batch.entity.js';

export const FEEDBACK_ITEM_STATUSES = [
  'queued',
  'coded',
  'needs_review',
  'failed',
] as const;
export type FeedbackItemStatus = (typeof FEEDBACK_ITEM_STATUSES)[number];

@Entity('feedback_items')
@Unique(['batchId', 'position'])
export class FeedbackItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  batchId: string;

  @ManyToOne(() => FeedbackBatch, (batch) => batch.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'batchId' })
  batch: FeedbackBatch;

  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', nullable: true })
  suggestedTag: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'varchar', nullable: true })
  finalTag: string | null;

  @Column({ type: 'varchar', default: 'queued' })
  status: FeedbackItemStatus;

  @Column({ type: 'varchar', nullable: true })
  jobId: string | null;

  @Column({ type: 'uuid', nullable: true })
  conversationId: string | null;

  @Column({ type: 'text', nullable: true })
  failedReason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
