import { isQuietTime } from '@renewals/shared/quiet-hours';
import type { Deps } from '../deps';
import type { NotificationRow } from '../repo';
import type { PushMessage } from './push';
import { texts } from './texts';

/** What sending needs; integrations get this without the full Deps. */
export type NotifyDeps = Pick<Deps, 'repo' | 'now' | 'log' | 'push'>;

export const PAYMENT_CATEGORY = 'payment';
const MAX_ATTEMPTS = 5;
const SUMMARY_LINES = 5;

export type NotificationKind =
  | 'renewal'
  | 'unpaid'
  | 'ms_licenses'
  | 'ms_subscription'
  | 'ms_license_user'
  | 'ms_new_user'
  | 'ms_connection'
  | 'ms_secret'
  | 'system';

/** Payment reminders get the "שולם" action button. */
const PAYMENT_KINDS = new Set<string>(['renewal', 'unpaid']);

export interface NewNotification {
  kind: NotificationKind;
  title: string;
  body: string;
  deepLink: string;
  dedupeKey: string;
  data?: Record<string, unknown>;
}

export async function isQuietNow(deps: NotifyDeps, now = deps.now()): Promise<boolean> {
  const s = await deps.repo.settings.all();
  return isQuietTime(now, { enabled: s.quiet_hours_enabled, city: s.quiet_hours_city });
}

/**
 * Queues a notification. The dedupe key guarantees the same thing never
 * notifies twice. Returns false when it was already queued or sent.
 */
export async function notify(deps: NotifyDeps, n: NewNotification): Promise<boolean> {
  const now = deps.now();
  const inserted = await deps.repo.notifications.enqueue({
    kind: n.kind,
    title: n.title,
    body: n.body,
    deep_link: n.deepLink,
    data: n.data ?? null,
    dedupe_key: n.dedupeKey,
    held: await isQuietNow(deps, now),
    created_at: now.toISOString(),
  });
  if (inserted) deps.log.info('notification.queued', { kind: n.kind, dedupeKey: n.dedupeKey });
  return inserted;
}

function toMessage(row: NotificationRow, token: string): PushMessage {
  const extra = row.data_json ? (JSON.parse(row.data_json) as Record<string, unknown>) : {};
  return {
    to: token,
    title: row.title,
    body: row.body,
    data: { ...extra, deepLink: row.deep_link },
    categoryId: PAYMENT_KINDS.has(row.kind) ? PAYMENT_CATEGORY : undefined,
  };
}

/** Sends to every registered phone and drops tokens Expo reports as invalid. Returns deliveries. */
export async function deliver(deps: NotifyDeps, build: (token: string) => PushMessage): Promise<number> {
  const tokens = await deps.repo.pushTokens.list();
  if (tokens.length === 0) return 0;
  const results = await deps.push.send(tokens.map(build));
  let ok = 0;
  for (const r of results) {
    if (r.ok) ok++;
    if (r.invalidToken) {
      await deps.repo.pushTokens.remove(r.token);
      deps.log.info('push.token_removed', {});
    } else if (!r.ok) {
      deps.log.warn('push.ticket_error', { error: r.error });
    }
  }
  return ok;
}

/**
 * Sends queued notifications, unless it is quiet time. Notifications collected
 * during quiet time go out as one summary ("נאספו {n} עדכונים").
 */
export async function processQueue(deps: NotifyDeps): Promise<{ sent: number; summarized: number }> {
  const now = deps.now();
  if (await isQuietNow(deps, now)) return { sent: 0, summarized: 0 };
  const queued = await deps.repo.notifications.listQueued();
  if (queued.length === 0) return { sent: 0, summarized: 0 };

  const held = queued.filter((n) => n.held === 1);
  const summarize = held.length >= 2;
  const single = summarize ? queued.filter((n) => n.held === 0) : queued;
  let sent = 0;

  if (summarize) {
    const text = texts.summary(
      held.length,
      held.slice(0, SUMMARY_LINES).map((n) => `${n.title}: ${n.body.split('\n')[0]}`),
    );
    const ids = held.map((n) => n.id);
    try {
      const ok = await deliver(deps, (to) => ({ to, ...text, data: { deepLink: '/' } }));
      if (ok > 0) {
        await deps.repo.notifications.markSent(ids, now.toISOString());
        sent += held.length;
      } else await deps.repo.notifications.markAttempt(ids, MAX_ATTEMPTS);
    } catch (e) {
      deps.log.warn('push.summary_failed', { error: e });
      await deps.repo.notifications.markAttempt(ids, MAX_ATTEMPTS);
    }
  }

  for (const row of single) {
    try {
      const ok = await deliver(deps, (to) => toMessage(row, to));
      if (ok > 0) {
        await deps.repo.notifications.markSent([row.id], now.toISOString());
        sent++;
      } else await deps.repo.notifications.markAttempt([row.id], MAX_ATTEMPTS);
    } catch (e) {
      deps.log.warn('push.send_failed', { id: row.id, error: e });
      await deps.repo.notifications.markAttempt([row.id], MAX_ATTEMPTS);
    }
  }
  deps.log.info('queue.processed', { sent, summarized: summarize ? held.length : 0 });
  return { sent, summarized: summarize ? held.length : 0 };
}
