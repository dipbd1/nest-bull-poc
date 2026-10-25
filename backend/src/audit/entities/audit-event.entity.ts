import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditMetadata = Record<
  string,
  string | number | boolean | null | string[]
>;

@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorEmail: string | null;

  @Column()
  action: string;

  @Column()
  targetType: string;

  @Column({ type: 'varchar', nullable: true })
  targetId: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: AuditMetadata;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
