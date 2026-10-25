import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { BatchService, type PurgeCounts } from '../batch/batch.service.js';
import { SettingsService } from '../settings/settings.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const RETENTION_INTERVAL_MS = DAY_MS;
export const RETENTION_STARTUP_DELAY_MS = 60_000;

export type RetentionResult = PurgeCounts & {
  retentionDays: number;
  cutoff: string;
};

/**
 * Daily in-process job. When an admin has set `retentionDays`, it deletes
 * batches older than that, with their items and conversations, and records one
 * audit event with counts. The audit row never carries comment text.
 */
@Injectable()
export class RetentionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RetentionService.name);
  private startupTimer: NodeJS.Timeout | null = null;
  private dailyTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly settings: SettingsService,
    private readonly batches: BatchService,
    private readonly audit: AuditService,
  ) {}

  onApplicationBootstrap(): void {
    this.startupTimer = setTimeout(() => {
      void this.tick();
    }, RETENTION_STARTUP_DELAY_MS);
    this.dailyTimer = setInterval(() => {
      void this.tick();
    }, RETENTION_INTERVAL_MS);
    // Neither timer may keep the process alive on shutdown.
    this.startupTimer.unref();
    this.dailyTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.dailyTimer) clearInterval(this.dailyTimer);
    this.startupTimer = null;
    this.dailyTimer = null;
  }

  /**
   * Runs one pass at `now`. Returns `null` when retention is off or nothing
   * was old enough, so an empty day leaves no audit row.
   */
  async purgeExpired(now: Date = new Date()): Promise<RetentionResult | null> {
    const { retentionDays } = await this.settings.get();
    if (retentionDays === null || retentionDays === undefined) return null;

    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    const counts = await this.batches.purgeCreatedBefore(cutoff);
    if (counts.batches === 0) return null;

    const result: RetentionResult = {
      ...counts,
      retentionDays,
      cutoff: cutoff.toISOString(),
    };
    await this.audit.record({
      actor: null,
      action: 'retention.purge',
      targetType: 'retention',
      targetId: null,
      metadata: { ...result },
    });
    return result;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.purgeExpired();
      if (result) {
        this.logger.log(
          `Retention removed ${result.batches} batches and ${result.items} comments`,
        );
      }
    } catch (error) {
      this.logger.error('Retention pass failed', error as Error);
    } finally {
      this.running = false;
    }
  }
}
