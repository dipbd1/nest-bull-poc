import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity.js';

export type ConversationMessageRole = 'system' | 'user' | 'assistant';

@Entity('conversation_messages')
export class ConversationMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column({ type: 'varchar' })
  role: ConversationMessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column()
  sequence: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
