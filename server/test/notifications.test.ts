import { israelTimeToInstant, type Service } from '@renewals/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { runCron } from '../src/core/cron';
import { notify, processQueue } from '../src/core/notifications/queue';
import { runDailyReminders } from '../src/core/notifications/reminders';
import { createHarness, type Harness } from './helpers/harness';

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbb]';

let h: Harness;

function setTime(date: string, hour: number, minute = 0) {
  h.clock.now = israelTimeToInstant(date, hour, minute);
}

async function addClientWithService(renewal: string, over: Record<string, unknown> = {}) {
  const client = (await (
    await h.request('/api/v1/clients', { method: 'POST', json: { name: 'כהן' } })
  ).json()) as { id: number };
  const service = (await (
    await h.request('/api/v1/services', {
      method: 'POST',
      json: { client_id: client.id, type: 'antivirus', label: 'ESET', renewal_date: renewal, ...over },
    })
  ).json()) as Service;
  return { client, service };
}

async function queued() {
  return (await h.repo.notifications.list()).filter((n) => n.status === 'queued');
}

beforeEach(async () => {
  h = await createHarness();
  await h.login();
  await h.request('/api/v1/push-tokens', { method: 'POST', json: { token: TOKEN_A } });
  setTime('2026-10-01', 10); // a Thursday
});

describe('daily reminders', () => {
  it('runs on the first run after 09:00, once a day', async () => {
    await addClientWithService('2026-10-31');
    setTime('2026-10-01', 8, 45);
    expect((await runDailyReminders(h.deps)).ran).toBe(false);
    setTime('2026-10-01', 9, 0);
    expect((await runDailyReminders(h.deps)).ran).toBe(true);
    setTime('2026-10-01', 9, 15);
    expect((await runDailyReminders(h.deps)).ran).toBe(false);
    const all = await h.repo.notifications.list();
    expect(all).toHaveLength(1);
    expect(all[0]!.title).toBe('חידוש בעוד 30 ימים');
    expect(all[0]!.body).toBe('כהן — אנטי וירוס ESET');
    expect(all[0]!.deep_link).toMatch(/^\/client\/\d+$/);
  });

  it('reminds at 30, 7 and 1 days before, never twice for the same step', async () => {
    await addClientWithService('2026-10-31');
    const titles: string[] = [];
    for (let day = 1; day <= 31; day++) {
      setTime(`2026-10-${String(day).padStart(2, '0')}`, 9, 5);
      await runDailyReminders(h.deps);
    }
    for (const n of await h.repo.notifications.list()) titles.push(n.title);
    expect(titles).toEqual(['חידוש בעוד 30 ימים', 'חידוש בעוד 7 ימים', 'חידוש מחר']);
  });

  it('does not remind about a renewal that is already paid', async () => {
    const { service } = await addClientWithService('2026-10-31');
    await h.request(`/api/v1/services/${service.id}/mark-paid`, { method: 'POST', json: {} });
    await runDailyReminders(h.deps);
    expect(await h.repo.notifications.list()).toHaveLength(0);
  });

  it('"not paid" on day 1, then every 7 days until paid', async () => {
    const { service } = await addClientWithService('2026-09-30');
    const sentOn: string[] = [];
    for (let day = 1; day <= 16; day++) {
      const date = `2026-10-${String(day).padStart(2, '0')}`;
      setTime(date, 9, 30);
      const before = (await h.repo.notifications.list()).length;
      await runDailyReminders(h.deps);
      if ((await h.repo.notifications.list()).length > before) sentOn.push(date);
    }
    expect(sentOn).toEqual(['2026-10-01', '2026-10-08', '2026-10-15']);
    const n = (await h.repo.notifications.list())[0]!;
    expect(n.title).toBe('כהן לא שילם');
    expect(n.body).toBe('אנטי וירוס ESET — מאז 30/09/2026');

    await h.request(`/api/v1/services/${service.id}/mark-paid`, { method: 'POST', json: {} });
    setTime('2026-10-22', 9, 30);
    await runDailyReminders(h.deps);
    expect(await h.repo.notifications.list()).toHaveLength(3);
  });

  it('warns 30 / 7 / 1 days before the Microsoft secret expires', async () => {
    h.deps.config.microsoft = { tenantId: 't', clientId: 'c', clientSecret: 's', secretExpiresAt: '2026-10-31' };
    const titles: string[] = [];
    for (let day = 1; day <= 31; day++) {
      setTime(`2026-10-${String(day).padStart(2, '0')}`, 9, 5);
      await runDailyReminders(h.deps);
    }
    for (const n of await h.repo.notifications.list()) titles.push(n.title);
    expect(titles).toEqual([
      'החיבור למיקרוסופט ייפסק בעוד 30 ימים',
      'החיבור למיקרוסופט ייפסק בעוד 7 ימים',
      'החיבור למיקרוסופט ייפסק מחר',
    ]);
  });
});

describe('dedupe', () => {
  it('never notifies the same thing twice', async () => {
    const n = { kind: 'system' as const, title: 't', body: 'b', deepLink: '/', dedupeKey: 'same' };
    expect(await notify(h.deps, n)).toBe(true);
    expect(await notify(h.deps, n)).toBe(false);
    await processQueue(h.deps);
    expect(await notify(h.deps, n)).toBe(false);
    await processQueue(h.deps);
    expect(h.push.sent).toHaveLength(1);
  });
});

describe('queue', () => {
  it('sends to every phone with the deep link, and the "שולם" action on payment reminders', async () => {
    await h.request('/api/v1/push-tokens', { method: 'POST', json: { token: TOKEN_B } });
    const { service, client } = await addClientWithService('2026-10-31');
    await runDailyReminders(h.deps);
    await processQueue(h.deps);
    expect(h.push.sent.map((m) => m.to).sort()).toEqual([TOKEN_A, TOKEN_B]);
    const msg = h.push.sent[0]!;
    expect(msg.categoryId).toBe('payment');
    expect(msg.data).toEqual({ deepLink: `/client/${client.id}`, serviceId: service.id, renewalDate: '2026-10-31' });
    expect(await queued()).toHaveLength(0);
  });

  it('removes tokens Expo reports as invalid', async () => {
    await h.request('/api/v1/push-tokens', { method: 'POST', json: { token: TOKEN_B } });
    h.push.invalid.add(TOKEN_B);
    await notify(h.deps, { kind: 'system', title: 't', body: 'b', deepLink: '/', dedupeKey: 'k' });
    await processQueue(h.deps);
    expect(await h.repo.pushTokens.list()).toEqual([TOKEN_A]);
    expect((await h.repo.notifications.list())[0]!.status).toBe('sent');
  });

  it('keeps a notification queued when sending fails, and gives up after 5 tries', async () => {
    await notify(h.deps, { kind: 'system', title: 't', body: 'b', deepLink: '/', dedupeKey: 'k' });
    h.push.failNext = true;
    await processQueue(h.deps);
    expect(await queued()).toHaveLength(1);
    await processQueue(h.deps);
    expect(await queued()).toHaveLength(0);
    expect((await h.repo.notifications.list())[0]!.status).toBe('sent');

    await h.repo.pushTokens.remove(TOKEN_A); // no phone at all
    await notify(h.deps, { kind: 'system', title: 't', body: 'b', deepLink: '/', dedupeKey: 'k2' });
    for (let i = 0; i < 5; i++) await processQueue(h.deps);
    expect((await h.repo.notifications.list())[1]!.status).toBe('failed');
  });
});

describe('quiet hours', () => {
  it('holds notifications at night and sends one summary in the morning', async () => {
    setTime('2026-10-06', 23, 30);
    for (let i = 1; i <= 7; i++) {
      await notify(h.deps, { kind: 'system', title: `כותרת ${i}`, body: `גוף ${i}`, deepLink: '/', dedupeKey: `n${i}` });
    }
    await processQueue(h.deps);
    setTime('2026-10-07', 6, 45);
    await processQueue(h.deps);
    expect(h.push.sent).toHaveLength(0);

    setTime('2026-10-07', 7, 0);
    await processQueue(h.deps);
    expect(h.push.sent).toHaveLength(1);
    const summary = h.push.sent[0]!;
    expect(summary.title).toBe('נאספו 7 עדכונים');
    expect(summary.body.split('\n')).toHaveLength(5);
    expect(summary.body.split('\n')[0]).toBe('כותרת 1: גוף 1');
    expect(await queued()).toHaveLength(0);
  });

  it('sends a single held notification as itself', async () => {
    setTime('2026-10-06', 23, 30);
    await notify(h.deps, { kind: 'system', title: 'אחת', body: 'b', deepLink: '/x', dedupeKey: 'one' });
    setTime('2026-10-07', 7, 15);
    await processQueue(h.deps);
    expect(h.push.sent.map((m) => m.title)).toEqual(['אחת']);
  });

  it('holds during Shabbat and releases after it ends', async () => {
    setTime('2026-10-16', 18, 0); // Friday, after candle lighting in Ramla
    await notify(h.deps, { kind: 'system', title: 'א', body: 'b', deepLink: '/', dedupeKey: 's1' });
    setTime('2026-10-17', 12, 0);
    await notify(h.deps, { kind: 'system', title: 'ב', body: 'b', deepLink: '/', dedupeKey: 's2' });
    await processQueue(h.deps);
    setTime('2026-10-17', 19, 0); // before the end of Shabbat (+82 min)
    await processQueue(h.deps);
    expect(h.push.sent).toHaveLength(0);
    setTime('2026-10-17', 19, 45);
    await processQueue(h.deps);
    expect(h.push.sent.map((m) => m.title)).toEqual(['נאספו 2 עדכונים']);
  });

  it('holds during Rosh Hashana 5787 until Sunday night', async () => {
    setTime('2026-09-12', 11, 0);
    await notify(h.deps, { kind: 'system', title: 'א', body: 'b', deepLink: '/', dedupeKey: 'r1' });
    await notify(h.deps, { kind: 'system', title: 'ב', body: 'b', deepLink: '/', dedupeKey: 'r2' });
    setTime('2026-09-13', 12, 0);
    await processQueue(h.deps);
    expect(h.push.sent).toHaveLength(0);
    setTime('2026-09-13', 20, 30);
    await processQueue(h.deps);
    expect(h.push.sent.map((m) => m.title)).toEqual(['נאספו 2 עדכונים']);
  });

  it('sends immediately when quiet hours are off', async () => {
    await h.request('/api/v1/settings', { method: 'PATCH', json: { quiet_hours_enabled: false } });
    setTime('2026-10-06', 23, 30);
    await notify(h.deps, { kind: 'system', title: 'לילה', body: 'b', deepLink: '/', dedupeKey: 'q' });
    await processQueue(h.deps);
    expect(h.push.sent.map((m) => m.title)).toEqual(['לילה']);
  });
});

describe('the "שולם" action', () => {
  it('marks the exact renewal from the notification as paid, once', async () => {
    const { service } = await addClientWithService('2026-09-30', { price_agorot: 12000 });
    await runDailyReminders(h.deps);
    await processQueue(h.deps);
    const msg = h.push.sent[0]!;
    expect(msg.title).toBe('כהן לא שילם');

    // What the app's background task sends when the button is tapped:
    const tap = () =>
      h.request(`/api/v1/services/${msg.data.serviceId}/mark-paid`, {
        method: 'POST',
        json: { expected_renewal_date: msg.data.renewalDate },
      });
    const first = (await (await tap()).json()) as { already_paid: boolean; service: Service };
    expect(first.already_paid).toBe(false);
    expect(first.service.renewal_date).toBe('2027-09-30T00:00:00.000Z');
    const second = (await (await tap()).json()) as { already_paid: boolean };
    expect(second.already_paid).toBe(true);
    expect(await h.repo.payments.listForService(service.id)).toHaveLength(1);

    // No more "not paid" reminders.
    setTime('2026-10-08', 9, 30);
    await runDailyReminders(h.deps);
    expect(await queued()).toHaveLength(0);
  });

  it('requires the fetch header like every mutation', async () => {
    const { service } = await addClientWithService('2026-09-30');
    const res = await h.request(`/api/v1/services/${service.id}/mark-paid`, {
      method: 'POST',
      headers: { 'X-Requested-With': 'nope' },
      json: {},
    });
    expect(res.status).toBe(403);
  });
});

describe('cron', () => {
  it('runs every step even when one throws, and alerts once a day', async () => {
    const ran: string[] = [];
    const steps = [
      { name: 'a', run: async () => void ran.push('a') },
      {
        name: 'b',
        run: async () => {
          throw new Error('boom');
        },
      },
      { name: 'c', run: async () => void ran.push('c') },
    ];
    expect((await runCron(h.deps, steps)).failed).toEqual(['b']);
    expect(ran).toEqual(['a', 'c']);
    await runCron(h.deps, steps);
    expect(h.push.sent.map((m) => m.title)).toEqual(['תקלה במערכת']);
  });

  it('a full run sends due reminders', async () => {
    await addClientWithService('2026-10-08');
    await runCron(h.deps);
    expect(h.push.sent.map((m) => m.title)).toEqual(['חידוש בעוד 7 ימים']);
  });
});

describe('settings and tokens API', () => {
  it('validates the city and push tokens', async () => {
    expect((await h.request('/api/v1/settings', { method: 'PATCH', json: { quiet_hours_city: 'לונדון' } })).status).toBe(400);
    const ok = await h.request('/api/v1/settings', { method: 'PATCH', json: { quiet_hours_city: 'חיפה' } });
    expect(await ok.json()).toEqual({ quiet_hours_enabled: true, quiet_hours_city: 'חיפה' });
    expect((await h.request('/api/v1/push-tokens', { method: 'POST', json: { token: 'nope' } })).status).toBe(400);
  });

  it('sends a test notification right away', async () => {
    setTime('2026-10-06', 23, 30); // even in quiet hours
    const res = await h.request('/api/v1/notifications/test', { method: 'POST' });
    expect(await res.json()).toEqual({ sent: 1 });
    expect(h.push.sent[0]!.title).toBe('התראת בדיקה');
  });

  it('unregisters a token on log out', async () => {
    await h.request('/api/v1/push-tokens', { method: 'DELETE', json: { token: TOKEN_A } });
    expect(await h.repo.pushTokens.list()).toEqual([]);
  });
});
