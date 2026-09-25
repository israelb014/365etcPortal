import type { ClientDetail, Service, Snapshot } from '@renewals/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './helpers/harness';

let h: Harness;

beforeEach(async () => {
  h = await createHarness();
  await h.login();
});

async function json<T>(res: Response | Promise<Response>): Promise<T> {
  return (await res).json() as Promise<T>;
}

async function newClient(name = 'כהן ושות׳') {
  const res = await h.request('/api/v1/clients', { method: 'POST', json: { name } });
  expect(res.status).toBe(201);
  return json<{ id: number; name: string }>(res);
}

async function newService(clientId: number, over: Record<string, unknown> = {}) {
  const res = await h.request('/api/v1/services', {
    method: 'POST',
    json: { client_id: clientId, type: 'antivirus', renewal_date: '2026-10-01', price_agorot: 25000, ...over },
  });
  expect(res.status).toBe(201);
  return json<Service>(res);
}

describe('clients and services', () => {
  it('creates a client with one service and shows it in the snapshot', async () => {
    const c = await newClient();
    const s = await newService(c.id, { label: 'ESET' });
    expect(s.cycle).toBe('yearly'); // default from the type list
    expect(s.renewal_date).toBe('2026-10-01T00:00:00.000Z');
    expect(s.anchor_day).toBe(1);
    const snap = await json<Snapshot>(h.request('/api/v1/snapshot'));
    expect(snap.clients.map((x) => x.name)).toEqual(['כהן ושות׳']);
    expect(snap.services).toHaveLength(1);
    expect(snap.microsoft.configured).toBe(false);
  });

  it('validates input', async () => {
    const c = await newClient();
    const bad = [
      { client_id: c.id, type: 'spaceship', renewal_date: '2026-10-01' },
      { client_id: c.id, type: 'domain', renewal_date: '2026-02-30' },
      { client_id: c.id, type: 'domain', renewal_date: '2026-10-01', price_agorot: -5 },
      { client_id: c.id, type: 'domain', renewal_date: '2026-10-01', price_agorot: 1.5 },
      { client_id: 999, type: 'domain', renewal_date: '2026-10-01' },
    ];
    for (const body of bad) {
      const res = await h.request('/api/v1/services', { method: 'POST', json: body });
      expect([400, 404]).toContain(res.status);
    }
    expect((await h.request('/api/v1/clients', { method: 'POST', json: { name: '  ' } })).status).toBe(400);
  });

  it('edits a service and keeps the anchor day in sync', async () => {
    const c = await newClient();
    const s = await newService(c.id);
    const res = await h.request(`/api/v1/services/${s.id}`, {
      method: 'PATCH',
      json: { renewal_date: '2027-01-31', cycle: 'monthly', price_agorot: 100 },
    });
    const updated = await json<Service>(res);
    expect(updated.anchor_day).toBe(31);
    expect(updated.cycle).toBe('monthly');
    expect(updated.price_agorot).toBe(100);
  });

  it('archives a client with its services', async () => {
    const c = await newClient();
    await newService(c.id);
    expect((await h.request(`/api/v1/clients/${c.id}/archive`, { method: 'POST' })).status).toBe(200);
    const snap = await json<Snapshot>(h.request('/api/v1/snapshot'));
    expect(snap.clients).toHaveLength(0);
    expect(snap.services).toHaveLength(0);
  });
});

describe('mark paid ("סמן כשולם")', () => {
  it('saves a payment, moves the renewal and writes history', async () => {
    const c = await newClient();
    const s = await newService(c.id, { cycle: 'monthly', renewal_date: '2026-01-31', price_agorot: 9900 });
    const res = await json<{ service: Service; payment: { amount_agorot: number } }>(
      h.request(`/api/v1/services/${s.id}/mark-paid`, { method: 'POST', json: {} }),
    );
    expect(res.payment.amount_agorot).toBe(9900);
    expect(res.service.renewal_date).toBe('2026-02-28T00:00:00.000Z');
    expect(res.service.paid_until).toBe('2026-01-31T00:00:00.000Z');
    // The anchor keeps the 31st after February.
    const again = await json<{ service: Service }>(
      h.request(`/api/v1/services/${s.id}/mark-paid`, { method: 'POST', json: {} }),
    );
    expect(again.service.renewal_date).toBe('2026-03-31T00:00:00.000Z');

    const detail = await json<ClientDetail>(h.request(`/api/v1/clients/${c.id}`));
    expect(detail.history[0]!.text).toContain('שולם');
    expect(await h.repo.payments.listForService(s.id)).toHaveLength(2);
  });

  it('is idempotent with expected_renewal_date (a second "שולם" tap does nothing)', async () => {
    const c = await newClient();
    const s = await newService(c.id);
    const tap = () =>
      json<{ already_paid: boolean; service: Service }>(
        h.request(`/api/v1/services/${s.id}/mark-paid`, {
          method: 'POST',
          json: { expected_renewal_date: '2026-10-01' },
        }),
      );
    const [a, b] = await Promise.all([tap(), tap()]);
    expect([a.already_paid, b.already_paid].sort()).toEqual([false, true]);
    expect(await h.repo.payments.listForService(s.id)).toHaveLength(1);
    expect((await h.repo.services.get(s.id))!.renewal_date).toBe('2027-10-01T00:00:00.000Z');
  });

  it('archives a one-time service after payment', async () => {
    const c = await newClient();
    const s = await newService(c.id, { cycle: 'once' });
    await h.request(`/api/v1/services/${s.id}/mark-paid`, { method: 'POST', json: {} });
    expect((await h.repo.services.get(s.id))!.archived_at).not.toBeNull();
  });
});

describe('export', () => {
  it('downloads all data as JSON', async () => {
    const c = await newClient();
    await newService(c.id);
    const res = await h.request('/api/v1/export');
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment; filename="renewals-2026-09-25.json"/);
    const data = (await res.json()) as Record<string, unknown[]>;
    expect(data.clients).toHaveLength(1);
    expect(data.services).toHaveLength(1);
    expect(data).not.toHaveProperty('sessions');
    expect(data).not.toHaveProperty('push_tokens');
  });
});
