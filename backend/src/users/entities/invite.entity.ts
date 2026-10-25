import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { UserRole } from '../../auth/entities/user.entity.js';

@Entity('invites')
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  email: string;

  @Column({ type: 'varchar' })
  role: UserRole;

  @Column({ unique: true })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'uuid', nullable: true })
  invitedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
