import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const SETTINGS_ROW_ID = 1;

@Entity('app_settings')
export class AppSettings {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  modelAllowlist: string[];

  @Column({ type: 'integer', nullable: true })
  retentionDays: number | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
