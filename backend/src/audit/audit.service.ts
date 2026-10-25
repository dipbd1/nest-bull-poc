import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent, type AuditMetadata } from './entities/audit-event.entity.js';

export type AuditActor = { id: string; email: string } | null;

export type AuditInput = {
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: AuditMetadata;
};

export type AuditEventView = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: AuditMetadata;
  createdAt: string;
};

export type AuditPage = {
  items: AuditEventView[];
  total: number;
  offset: number;
  limit: number;
};

function toView(event: AuditEvent): AuditEventView {
  return {
    id: event.id,
    actorId: event.actorId,
    actorEmail: event.actorEmail,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly events: Repository<AuditEvent>,
  ) {}

  async record(input: AuditInput): Promise<void> {
    await this.events.save(
      this.events.create({
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? {},
      }),
    );
  }

  async list(offset = 0, limit = 50): Promise<AuditPage> {
    const [events, total] = await this.events.findAndCount({
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    return { items: events.map(toView), total, offset, limit };
  }
}
