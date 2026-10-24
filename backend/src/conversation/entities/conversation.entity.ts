import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationMessage } from './conversation-message.entity.js';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ unique: true })
  jobId: string;

  @Column()
  title: string;

  @Column()
  provider: string;

  @Column()
  model: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ConversationMessage, (message) => message.conversation, {
    cascade: true,
  })
  messages: ConversationMessage[];
}
