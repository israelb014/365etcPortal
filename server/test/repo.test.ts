import { toStoredDate } from '@renewals/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRepo, type Repo } from '../src/core/repo';
import { createTestDb } from './helpers/sqliteDb';

const NOW = '2026-09-25T08:00:00.000Z';
let repo: Repo;

beforeEach(() => {
  repo = createRepo(createTestDb());
});

describe('repository', () => {
  it('applies migrations and returns default settings', async () => {
    expect(await repo.settings.all()).toEqual({ quiet_hours_enabled: true, quiet_hours_city: 'רמלה' });
    await repo.settings.set('quiet_hours_enabled', '0');
    await repo.settings.set('quiet_hours_city', 'חיפה');
    expect(await repo.settings.all()).toEqual({ quiet_hours_enabled: false, quiet_hours_city: 'חיפה' });
  });

  it('creates, updates and lists clients and services', async () => {
    const c = await repo.clients.create({ name: 'כהן', phone: null, note: null }, NOW);
    await repo.clients.update(c.id, { phone: '050-1234567' });
    expect((await repo.clients.get(c.id))!.phone).toBe('050-1234567');

    const s = await repo.services.create(
      {
        client_id: c.id,
        type: 'antivirus',
        label: 'ESET',
        quantity: 2,
        renewal_date: toStoredDate('2026-12-01'),
        anchor_day: 1,
        cycle: 'yearly',
        cost_agorot: 100,
        price_agorot: 200,
        paid_until: null,
        auto_renew: true,
        source: 'manual',
        external_ref: null,
        note: null,
      },
      NOW,
    );
    expect(s.auto_renew).toBe(true);
    await repo.services.update(s.id, { archived_at: NOW, auto_renew: false });
    const updated = (await repo.services.get(s.id))!;
    expect(updated.archived_at).toBe(NOW);
    expect(updated.auto_renew).toBe(false);
    expect(await repo.services.listActive()).toHaveLength(0);
    expect(await repo.services.list()).toHaveLength(1);
  });

  it('never inserts the same dedupe key twice', async () => {
    const n = { kind: 'x', title: 't', body: 'b', deep_link: '/', dedupe_key: 'k1', held: false, created_at: NOW };
    expect(await repo.notifications.enqueue(n)).toBe(true);
    expect(await repo.notifications.enqueue({ ...n, title: 'other' })).toBe(false);
    expect(await repo.notifications.listQueued()).toHaveLength(1);
  });

  it('marks notifications failed after max attempts', async () => {
    await repo.notifications.enqueue({
      kind: 'x', title: 't', body: 'b', deep_link: '/', dedupe_key: 'k', held: false, created_at: NOW,
    });
    const [n] = await repo.notifications.listQueued();
    await repo.notifications.markAttempt([n!.id], 2);
    expect(await repo.notifications.listQueued()).toHaveLength(1);
    await repo.notifications.markAttempt([n!.id], 2);
    expect(await repo.notifications.listQueued()).toHaveLength(0);
    expect((await repo.notifications.list())[0]!.status).toBe('failed');
  });

  it('stores microsoft users and counts unassigned licensed users', async () => {
    await repo.msUsers.upsert({ graph_id: 'g1', upn: 'a@x.com', display_name: 'A', sku_ids: ['s1'] });
    await repo.msUsers.upsert({ graph_id: 'g2', upn: 'b@x.com', display_name: 'B', sku_ids: [] });
    expect(await repo.msUsers.countUnassigned()).toBe(1);
    const c = await repo.clients.create({ name: 'A', phone: null, note: null }, NOW);
    await repo.msUsers.setClient('g1', c.id);
    expect(await repo.msUsers.countUnassigned()).toBe(0);
    expect((await repo.msUsers.get('g1'))!.sku_ids).toEqual(['s1']);
  });

  it('runs batches atomically', async () => {
    const c = await repo.clients.create({ name: 'A', phone: null, note: null }, NOW);
    await expect(
      repo.db.batch([
        repo.history.insertStatement({ client_id: c.id, service_id: null, text: 'ok', created_at: NOW }),
        { sql: 'INSERT INTO nope VALUES (1)', params: [] },
      ]),
    ).rejects.toThrow();
    expect(await repo.history.listForClient(c.id, 10)).toHaveLength(0);
  });
});
