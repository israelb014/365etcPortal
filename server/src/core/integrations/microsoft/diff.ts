import type { MsState } from './state';

export type SubscriptionAlert = 'Warning' | 'Suspended' | 'Deleted' | 'Enabled';

export type MsEvent =
  | { type: 'licenses_bought'; skuId: string; name: string; total: number; free: number }
  | { type: 'licenses_reduced'; skuId: string; name: string; total: number }
  | { type: 'subscription_status'; subId: string; name: string; status: SubscriptionAlert }
  | { type: 'license_assigned'; graphId: string; skuIds: string[] }
  | { type: 'license_removed'; graphId: string; skuIds: string[] }
  | { type: 'new_user'; graphId: string };

function alertFor(status: string): SubscriptionAlert | null {
  if (status === 'Warning') return 'Warning';
  if (status === 'Suspended' || status === 'LockedOut') return 'Suspended';
  if (status === 'Deleted') return 'Deleted';
  if (status === 'Enabled') return 'Enabled';
  return null;
}

/**
 * Compares two snapshots. Pure. The first sync (no previous state) produces
 * nothing: it only records the state.
 */
export function diffStates(prev: MsState | null, next: MsState, isLinked: (graphId: string) => boolean): MsEvent[] {
  if (!prev) return [];
  const events: MsEvent[] = [];

  for (const [skuId, n] of Object.entries(next.skus)) {
    const before = prev.skus[skuId]?.total ?? 0;
    if (n.total > before) {
      events.push({ type: 'licenses_bought', skuId, name: n.name, total: n.total, free: Math.max(0, n.total - n.used) });
    } else if (n.total < before) {
      events.push({ type: 'licenses_reduced', skuId, name: n.name, total: n.total });
    }
  }
  for (const [skuId, p] of Object.entries(prev.skus)) {
    if (!next.skus[skuId] && p.total > 0) events.push({ type: 'licenses_reduced', skuId, name: p.name, total: 0 });
  }

  for (const [subId, n] of Object.entries(next.subs)) {
    const before = prev.subs[subId]?.status;
    if (before === n.status) continue;
    const alert = alertFor(n.status);
    if (!alert) continue;
    // A brand-new enabled subscription is a purchase, reported through the license count.
    if (alert === 'Enabled' && (before === undefined || alertFor(before) === 'Enabled')) continue;
    if (before !== undefined && alertFor(before) === alert) continue;
    events.push({ type: 'subscription_status', subId, name: n.name, status: alert });
  }

  const ids = new Set([...Object.keys(prev.users), ...Object.keys(next.users)]);
  for (const graphId of ids) {
    const before = prev.users[graphId]?.skus ?? [];
    const after = next.users[graphId]?.skus ?? [];
    const added = after.filter((s) => !before.includes(s));
    const removed = before.filter((s) => !after.includes(s));
    if (added.length > 0) {
      if (before.length === 0 && !isLinked(graphId)) events.push({ type: 'new_user', graphId });
      else events.push({ type: 'license_assigned', graphId, skuIds: added });
    }
    if (removed.length > 0) events.push({ type: 'license_removed', graphId, skuIds: removed });
  }
  return events;
}
