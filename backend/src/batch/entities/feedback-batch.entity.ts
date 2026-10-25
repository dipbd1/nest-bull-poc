import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FeedbackItem } from './feedback-item.entity.js';

@Entity('feedback_batches')
export class FeedbackBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  model: string;

  @Column({ type: 'text', array: true })
  tags: string[];

  @Column({ type: 'uuid' })
  createdById: string;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => FeedbackItem, (item) => item.batch)
  items: FeedbackItem[];
}
