import {
  daysBetween,
  daysUntilRenewal,
  fromStoredDate,
  isRenewalUnpaid,
  israelParts,
  serviceTitle,
  type DateOnly,
} from '@renewals/shared';
import type { Deps } from '../deps';
import { SETTING_KEYS } from '../repo';
import { notify } from './queue';
import { texts } from './texts';

export const DAILY_HOUR = 9;
export const RENEWAL_THRESHOLDS = [30, 7, 1] as const;
export const SECRET_THRESHOLDS = [30, 7, 1] as const;
const UNPAID_REPEAT_DAYS = 7;

/** The smallest threshold that `days` has reached (e.g. 5 → 7), or null when further out. */
export function thresholdBucket(days: number, thresholds: readonly number[]): number | null {
  let bucket: number | null = null;
  for (const t of thresholds) if (days <= t) bucket = bucket === null ? t : Math.min(bucket, t);
  return bucket;
}

/**
 * Daily reminders, on the first Cron run after 09:00 Israel time:
 * - renewal in 30 / 7 / 1 days (unpaid renewals only)
 * - not paid: on day 1, then every 7 days until paid
 * - the Microsoft secret expiring in 30 / 7 / 1 days
 * Dedupe keys make a missed or repeated run safe.
 */
export async function runDailyReminders(deps: Deps, now = deps.now()): Promise<{ ran: boolean }> {
  const local = israelParts(now);
  if (local.hour < DAILY_HOUR) return { ran: false };
  if ((await deps.repo.settings.get(SETTING_KEYS.dailyLastRun)) === local.date) return { ran: false };
  const today = local.date;

  const clients = new Map((await deps.repo.clients.list()).map((c) => [c.id, c]));
  for (const service of await deps.repo.services.listActive()) {
    const client = clients.get(service.client_id);
    if (!client || client.archived_at || !isRenewalUnpaid(service)) continue;
    const days = daysUntilRenewal(service, today);
    const renewal = fromStoredDate(service.renewal_date);
    const name = serviceTitle(service);
    const data = { serviceId: service.id, renewalDate: renewal };
    const deepLink = `/client/${client.id}`;

    if (days >= 0) {
      const bucket = thresholdBucket(days, RENEWAL_THRESHOLDS);
      if (bucket === null) continue;
      await notify(deps, {
        kind: 'renewal',
        ...texts.renewalSoon(days, client.name, name),
        deepLink,
        data,
        dedupeKey: `renewal:${service.id}:${renewal}:${bucket}`,
      });
    } else {
      const overdue = -days;
      const round = Math.floor((overdue - 1) / UNPAID_REPEAT_DAYS);
      await notify(deps, {
        kind: 'unpaid',
        ...texts.notPaid(client.name, name, renewal),
        deepLink,
        data,
        dedupeKey: `unpaid:${service.id}:${renewal}:${round}`,
      });
    }
  }

  await checkSecretExpiry(deps, today);
  await deps.repo.sessions.deleteExpired(now.toISOString());
  await deps.repo.settings.set(SETTING_KEYS.dailyLastRun, today);
  deps.log.info('reminders.done', { date: today });
  return { ran: true };
}

async function checkSecretExpiry(deps: Deps, today: DateOnly): Promise<void> {
  const expires = deps.config.microsoft?.secretExpiresAt;
  if (!expires || !/^\d{4}-\d{2}-\d{2}/.test(expires)) return;
  const days = daysBetween(today, expires.slice(0, 10));
  if (days < 0) return;
  const bucket = thresholdBucket(days, SECRET_THRESHOLDS);
  if (bucket === null) return;
  await notify(deps, {
    kind: 'ms_secret',
    ...texts.secretExpiring(days),
    deepLink: '/settings',
    dedupeKey: `ms-secret:${expires.slice(0, 10)}:${bucket}`,
  });
}
