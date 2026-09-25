import { israelTimeToInstant, type MicrosoftSummary, type MsUserDetail, type Service, type Snapshot } from '@renewals/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { microsoftIntegration } from '../src/core/integrations';
import { diffStates } from '../src/core/integrations/microsoft/diff';
import type { MsState } from '../src/core/integrations/microsoft/state';
import { suggestClients } from '../src/core/integrations/microsoft/similarity';
import { processQueue } from '../src/core/notifications/queue';
import { FakeTenant, SKU_BASIC, SKU_STD, TENANT } from './helpers/fakeTenant';
import { createHarness, type Harness } from './helpers/harness';

let h: Harness;
let tenant: FakeTenant;

const ms = () => microsoftIntegration(h.deps)!;

async function titles(): Promise<string[]> {
  return (await h.repo.notifications.list()).map((n) => n.title);
}

async function connect() {
  const res = await h.request('/api/v1/integrations/microsoft/connect', { method: 'POST' });
  expect(res.status).toBe(200);
  return (await res.json()) as MicrosoftSummary;
}

async function newClient(name: string) {
  return (await (await h.request('/api/v1/clients', { method: 'POST', json: { name } })).json()) as { id: number };
}

async function link(graphId: string, body: Record<string, unknown>) {
  const res = await h.request(`/api/v1/microsoft/users/${graphId}/link`, { method: 'POST', json: body });
  expect(res.status).toBe(200);
  return (await res.json()) as { client_id: number };
}

beforeEach(async () => {
  h = await createHarness({
    microsoft: { tenantId: TENANT, clientId: 'app', clientSecret: 'secret', secretExpiresAt: '2027-06-01' },
  });
  await h.login();
  h.clock.now = israelTimeToInstant('2026-10-01', 10, 0);
  await h.request('/api/v1/push-tokens', { method: 'POST', json: { token: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]' } });
  tenant = new FakeTenant(h);
});

describe('connection', () => {
  it('is off when the secrets are not set', async () => {
    const plain = await createHarness();
    await plain.login();
    const snap = (await (await plain.request('/api/v1/snapshot')).json()) as Snapshot;
    expect(snap.microsoft).toMatchObject({ configured: false, connected: false, status: 'off' });
    expect((await plain.request('/api/v1/integrations/microsoft/connect', { method: 'POST' })).status).toBe(400);
  });

  it('first sync saves the state only and sends nothing', async () => {
    const summary = await connect();
    expect(summary).toMatchObject({
      configured: true,
      connected: true,
      status: 'ok',
      licenses_total: 5, // the free 10000-unit SKU is not counted
      licenses_used: 2,
      unassigned_users: 2,
      secret_expires_at: '2027-06-01',
    });
    expect(await h.repo.notifications.list()).toHaveLength(0);
    expect((await h.repo.msUsers.list()).map((u) => u.graph_id).sort()).toEqual(['u1', 'u2', 'u3']);
    expect(tenant.calls).toBeGreaterThanOrEqual(5); // token + skus + subscriptions + 2 user pages
  });

  it('does nothing while disconnected', async () => {
    await connect();
    await h.request('/api/v1/integrations/microsoft/disconnect', { method: 'POST' });
    tenant.calls = 0;
    await ms().sync();
    expect(tenant.calls).toBe(0);
    const snap = (await (await h.request('/api/v1/snapshot')).json()) as Snapshot;
    expect(snap.microsoft.connected).toBe(false);
  });

  it('reports a failed connect in Hebrew and stays disconnected', async () => {
    tenant.down = true;
    const res = await h.request('/api/v1/integrations/microsoft/connect', { method: 'POST' });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { message: string }).message).toContain('מיקרוסופט');
    expect((await ms().describe()).connected).toBe(false);
  });
});

describe('events', () => {
  beforeEach(async () => {
    await connect();
  });

  it('licenses bought', async () => {
    tenant.skus[0]!.prepaidUnits.enabled = 7;
    await ms().sync();
    const [n] = await h.repo.notifications.list();
    expect(n).toMatchObject({ title: 'נקנה רישיון', body: 'יש עכשיו 7 רישיונות, 5 פנויים' });
  });

  it('licenses reduced', async () => {
    tenant.skus[0]!.prepaidUnits.enabled = 4;
    await ms().sync();
    expect(await h.repo.notifications.list()).toMatchObject([{ title: 'הוסר רישיון מהמנוי', body: 'נשארו 4 רישיונות' }]);
  });

  it('subscription Warning → Suspended → Deleted → back to Enabled', async () => {
    const sub = tenant.subscriptions[0]!;
    for (const status of ['Warning', 'Suspended', 'Deleted', 'Enabled']) {
      sub.status = status;
      await ms().sync();
    }
    const list = await h.repo.notifications.list();
    expect(list.map((n) => [n.title, n.body])).toEqual([
      ['מנוי מיקרוסופט פג', 'יש עוד זמן לחדש לפני השבתה'],
      ['מנוי מיקרוסופט הושבת', 'הלקוחות לא יכולים לעבוד. צריך לחדש עכשיו'],
      ['מנוי מיקרוסופט נמחק', 'Business Standard'],
      ['מנוי מיקרוסופט פעיל שוב', 'Business Standard'],
    ]);
    expect(list.every((n) => n.deep_link === '/settings')).toBe(true);
  });

  it('new licensed user not linked to a client', async () => {
    tenant.users.push({ id: 'u9', displayName: 'Yossi', userPrincipalName: 'yossi@x.co.il', assignedLicenses: [{ skuId: SKU_STD }] });
    await ms().sync();
    const [n] = await h.repo.notifications.list();
    expect(n).toMatchObject({ title: 'משתמש חדש', body: 'למי הוא שייך?', deep_link: '/assign/u9' });
    // An unlicensed user getting a license is also "new" when unlinked.
    tenant.setUserSkus('u3', [SKU_STD]);
    await ms().sync();
    expect((await titles()).filter((t) => t === 'משתמש חדש')).toHaveLength(2);
  });

  it('license assigned to / removed from a linked user', async () => {
    const client = await newClient('כהן עורכי דין');
    await link('u1', { client_id: client.id });
    tenant.skus.push({ skuId: SKU_BASIC, skuPartNumber: 'O365_BUSINESS_ESSENTIALS', consumedUnits: 0, prepaidUnits: { enabled: 3 } });
    tenant.setUserSkus('u1', [SKU_STD, SKU_BASIC]);
    await ms().sync();
    tenant.setUserSkus('u1', [SKU_BASIC]);
    await ms().sync();
    const list = await h.repo.notifications.list();
    expect(list.map((n) => [n.title, n.body])).toEqual([
      ['נקנה רישיון', 'יש עכשיו 3 רישיונות, 2 פנויים'],
      ['רישיון הוקצה', 'כהן עורכי דין'],
      ['רישיון הוסר', 'כהן עורכי דין — הרישיון פנוי עכשיו'],
    ]);
    expect(list[1]!.deep_link).toBe(`/client/${client.id}`);
  });

  it('sends Microsoft events immediately (no daily wait)', async () => {
    tenant.skus[0]!.prepaidUnits.enabled = 6;
    await ms().sync();
    await processQueue(h.deps);
    expect(h.push.sent.map((m) => m.title)).toEqual(['נקנה רישיון']);
  });

  it('never notifies twice for the same change', async () => {
    tenant.skus[0]!.prepaidUnits.enabled = 6;
    await ms().sync();
    await ms().sync();
    await ms().sync();
    expect(await titles()).toEqual(['נקנה רישיון']);
  });
});

describe('"למי שייך?" linking', () => {
  beforeEach(async () => {
    await connect();
  });

  it('suggests clients by name similarity first', async () => {
    await newClient('משרד כהן');
    await newClient('Levi Sport');
    await newClient('אחר לגמרי');
    const res = await h.request('/api/v1/microsoft/users/u2');
    const detail = (await res.json()) as MsUserDetail;
    expect(detail.user.display_name).toBe('Rina Levi');
    expect(detail.suggestions.map((c) => c.name)).toEqual(['Levi Sport']);
    expect(detail.clients).toHaveLength(3);
    expect(detail.licenses).toEqual(['Business Standard']);
  });

  it('creates the client microsoft365 service with the subscription renewal date', async () => {
    const client = await newClient('כהן');
    await link('u1', { client_id: client.id });
    const services = (await h.repo.services.listForClient(client.id)) as Service[];
    expect(services).toHaveLength(1);
    expect(services[0]).toMatchObject({
      type: 'microsoft365',
      source: 'microsoft',
      external_ref: 'u1',
      renewal_date: '2027-03-14T00:00:00.000Z', // 23:59 on the 14th in Israel (UTC+2)
      label: 'דני כהן (Business Standard)',
    });
    expect((await ms().describe()).unassigned_users).toBe(1);
  });

  it('can create a new client in the same tap', async () => {
    const { client_id } = await link('u2', { new_client_name: 'Rina Levi' });
    expect((await h.repo.clients.get(client_id))!.name).toBe('Rina Levi');
    expect(await h.repo.services.listForClient(client_id)).toHaveLength(1);
  });

  it('archives the service when the license is removed, and never touches manual data', async () => {
    const client = await newClient('כהן');
    await h.request('/api/v1/services', {
      method: 'POST',
      json: { client_id: client.id, type: 'microsoft365', label: 'ידני', renewal_date: '2026-12-01', price_agorot: 5000 },
    });
    await link('u1', { client_id: client.id });
    const msService = (await h.repo.services.findExternal('microsoft', 'u1'))[0]!;
    await h.request(`/api/v1/services/${msService.id}`, { method: 'PATCH', json: { price_agorot: 9900 } });

    tenant.subscriptions[0]!.nextLifecycleDateTime = '2028-03-15T08:00:00Z';
    await ms().sync();
    const renewed = (await h.repo.services.get(msService.id))!;
    expect(renewed.renewal_date).toBe('2028-03-15T00:00:00.000Z');
    expect(renewed.price_agorot).toBe(9900); // the owner's price stays

    tenant.setUserSkus('u1', []);
    await ms().sync();
    expect((await h.repo.services.get(msService.id))!.archived_at).not.toBeNull();
    const manual = (await h.repo.services.list()).find((s) => s.source === 'manual')!;
    expect(manual).toMatchObject({ label: 'ידני', price_agorot: 5000, archived_at: null });

    // License back → the same service comes back.
    tenant.setUserSkus('u1', [SKU_STD]);
    await ms().sync();
    expect((await h.repo.services.get(msService.id))!.archived_at).toBeNull();
  });

  it('re-linking to another client moves the service', async () => {
    const a = await newClient('א');
    const b = await newClient('ב');
    await link('u1', { client_id: a.id });
    await link('u1', { client_id: b.id });
    expect(await h.repo.services.listForClient(a.id)).toHaveLength(0);
    expect(await h.repo.services.listForClient(b.id)).toHaveLength(1);
  });
});

describe('errors and retries', () => {
  beforeEach(async () => {
    await connect();
  });

  it('retries 429 / 503 using Retry-After, at most 3 attempts', async () => {
    tenant.failures = [{ status: 429, retryAfter: '7' }, { status: 503 }];
    tenant.skus[0]!.prepaidUnits.enabled = 6;
    await ms().sync();
    expect(h.sleeps.slice(0, 2)).toEqual([7000, 2000]);
    expect((await ms().describe()).consecutive_failures).toBe(0);
    expect(await titles()).toEqual(['נקנה רישיון']);

    tenant.failures = [{ status: 503 }, { status: 503 }, { status: 503 }];
    await ms().sync();
    expect((await ms().describe()).consecutive_failures).toBe(1);
  });

  it('alerts after 3 failed syncs in a row, once, and once on recovery', async () => {
    tenant.down = true;
    await ms().sync();
    await ms().sync();
    expect(await titles()).toEqual([]);
    await ms().sync();
    await ms().sync();
    expect(await titles()).toEqual(['יש בעיה בחיבור למיקרוסופט']);
    const failing = await ms().describe();
    expect(failing).toMatchObject({ status: 'error', consecutive_failures: 4 });
    expect(failing.last_error).toContain('מיקרוסופט');

    tenant.down = false;
    await ms().sync();
    await ms().sync();
    expect(await titles()).toEqual(['יש בעיה בחיבור למיקרוסופט', 'החיבור למיקרוסופט חזר לעבוד']);
    expect(await ms().describe()).toMatchObject({ status: 'ok', consecutive_failures: 0, last_error: null });
  });

  it('a Microsoft outage does not raise the general system alert', async () => {
    const { runCron } = await import('../src/core/cron');
    tenant.down = true;
    const result = await runCron(h.deps);
    expect(result.failed).toEqual([]);
  });
});

describe('diff (pure)', () => {
  const base: MsState = {
    skus: { s: { name: 'Std', total: 5, used: 2 } },
    subs: { x: { skuId: 's', name: 'Std', status: 'Enabled', next: null } },
    users: { a: { upn: 'a@x', name: 'A', skus: ['s'] } },
  };

  it('first sync produces no events', () => {
    expect(diffStates(null, base, () => false)).toEqual([]);
  });

  it('detects every event type', () => {
    const next: MsState = {
      skus: { s: { name: 'Std', total: 6, used: 2 } },
      subs: { x: { skuId: 's', name: 'Std', status: 'Suspended', next: null } },
      users: { a: { upn: 'a@x', name: 'A', skus: [] }, b: { upn: 'b@x', name: 'B', skus: ['s'] } },
    };
    expect(diffStates(base, next, () => false).map((e) => e.type).sort()).toEqual(
      ['license_removed', 'licenses_bought', 'new_user', 'subscription_status'].sort(),
    );
  });

  it('suggests nothing for unrelated names', () => {
    const clients = [{ id: 1, name: 'מאפיית השכונה', phone: null, note: null, archived_at: null, created_at: '' }];
    expect(suggestClients({ display_name: 'John Smith', upn: 'john@smith.com' }, clients)).toEqual([]);
  });
});
