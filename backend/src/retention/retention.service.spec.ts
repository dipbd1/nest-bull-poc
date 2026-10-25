import { RetentionService } from './retention.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { BatchService } from '../batch/batch.service.js';
import type { SettingsService } from '../settings/settings.service.js';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const COMMENT = 'My account number is 12345';

function build(retentionDays: number | null, purged = { batches: 2, items: 7, conversations: 5 }) {
  const settings = { get: vi.fn().mockResolvedValue({ retentionDays }) };
  const batches = { purgeCreatedBefore: vi.fn().mockResolvedValue(purged) };
  const audit = { record: vi.fn() };
  const service = new RetentionService(
    settings as unknown as SettingsService,
    batches as unknown as BatchService,
    audit as unknown as AuditService,
  );
  return { service, settings, batches, audit };
}

describe('RetentionService', () => {
  it('does nothing when no keep period is set', async () => {
    const { service, batches, audit } = build(null);

    await expect(service.purgeExpired(NOW)).resolves.toBeNull();

    expect(batches.purgeCreatedBefore).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('deletes batches older than the period and audits counts only', async () => {
    const { service, batches, audit } = build(30);

    const result = await service.purgeExpired(NOW);

    const cutoff = new Date(NOW.getTime() - 30 * DAY_MS);
    expect(batches.purgeCreatedBefore).toHaveBeenCalledWith(cutoff);
    expect(result).toEqual({
      batches: 2,
      items: 7,
      conversations: 5,
      retentionDays: 30,
      cutoff: cutoff.toISOString(),
    });
    expect(audit.record).toHaveBeenCalledTimes(1);
    const event = audit.record.mock.calls[0][0] as {
      action: string;
      actor: unknown;
      metadata: Record<string, unknown>;
    };
    expect(event.action).toBe('retention.purge');
    expect(event.actor).toBeNull();
    expect(event.metadata).toMatchObject({
      batches: 2,
      items: 7,
      conversations: 5,
      retentionDays: 30,
    });
    expect(JSON.stringify(event)).not.toContain(COMMENT);
  });

  it('leaves no audit row when nothing was old enough', async () => {
    const { service, audit } = build(30, {
      batches: 0,
      items: 0,
      conversations: 0,
    });

    await expect(service.purgeExpired(NOW)).resolves.toBeNull();

    expect(audit.record).not.toHaveBeenCalled();
  });
});
