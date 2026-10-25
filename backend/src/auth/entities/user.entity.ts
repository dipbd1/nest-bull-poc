import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RegistrationCode } from './registration-code.entity.js';

export const USER_ROLES = ['admin', 'reviewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'varchar', default: 'reviewer' })
  role: UserRole;

  @Column({ type: 'timestamptz', nullable: true })
  disabledAt: Date | null;

  @Column({ type: 'integer', default: 1 })
  sessionVersion: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => RegistrationCode, (code) => code.user)
  registrationCodes: RegistrationCode[];
}
