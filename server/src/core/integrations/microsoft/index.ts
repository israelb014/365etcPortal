import {
  defaultRenewalDate,
  fromStoredDate,
  israelDate,
  toStoredDate,
  type Client,
  type MicrosoftSummary,
  type MsUser,
} from '@renewals/shared';
import type { Deps } from '../../deps';
import { HttpError } from '../../http';
import { errorInfo } from '../../log';
import { notify } from '../../notifications/queue';
import { texts } from '../../notifications/texts';
import { archiveService, createService } from '../../operations';
import type { IntegrationRow } from '../../repo';
import type { Integration } from '../integration';
import { diffStates, type MsEvent } from './diff';
import { GraphClient, GraphError } from './graph';
import { buildState, licenseTotals, type MsState } from './state';

export const MICROSOFT = 'microsoft';
export const FAILURES_BEFORE_ALERT = 3;

interface Stored {
  snapshot: MsState | null;
  /** When the current failure streak started (dedupes the alert and the recovery notice). */
  failingSince: string | null;
}

type IntegrationDeps = Omit<Deps, 'integrations'>;

function readStored(row: IntegrationRow | null): Stored {
  if (!row?.state_json) return { snapshot: null, failingSince: null };
  try {
    const parsed = JSON.parse(row.state_json) as Partial<Stored>;
    return { snapshot: parsed.snapshot ?? null, failingSince: parsed.failingSince ?? null };
  } catch {
    return { snapshot: null, failingSince: null };
  }
}

function emptyRow(tenantId: string | null): IntegrationRow {
  return {
    type: MICROSOFT,
    tenant_id: tenantId,
    status: 'off',
    last_sync_at: null,
    last_error: null,
    consecutive_failures: 0,
    state_json: null,
  };
}

/** Short Hebrew reason shown in Settings. */
function failureText(e: unknown): string {
  if (e instanceof GraphError) {
    if (e.status === 401 || e.status === 400) return 'מיקרוסופט דחתה את פרטי החיבור. כדאי לבדוק את המפתח וההרשאות';
    if (e.status === 403) return 'חסרה הרשאה. צריך לאשר הרשאות מנהל באפליקציה של מיקרוסופט';
    if (e.status === 429 || e.status >= 500) return `מיקרוסופט לא זמינה כרגע (${e.status})`;
    return `מיקרוסופט החזירה שגיאה (${e.status})`;
  }
  return 'אין תקשורת עם מיקרוסופט';
}

export function createMicrosoftIntegration(deps: IntegrationDeps) {
  const ms = deps.config.microsoft;

  async function loadRow(): Promise<IntegrationRow> {
    return (await deps.repo.integrations.get(MICROSOFT)) ?? emptyRow(ms?.tenantId ?? null);
  }

  async function recordFailure(row: IntegrationRow, stored: Stored, e: unknown): Promise<void> {
    const failures = row.consecutive_failures + 1;
    const failingSince = stored.failingSince ?? deps.now().toISOString();
    await deps.repo.integrations.save({
      ...row,
      consecutive_failures: failures,
      last_error: failureText(e),
      status: failures >= FAILURES_BEFORE_ALERT ? 'error' : row.status,
      state_json: JSON.stringify({ ...stored, failingSince }),
    });
    deps.log.warn('microsoft.sync_failed', { failures, error: errorInfo(e).message });
    if (failures >= FAILURES_BEFORE_ALERT) {
      await notify(deps, {
        kind: 'ms_connection',
        ...texts.microsoftFailing(),
        deepLink: '/settings',
        dedupeKey: `ms-failing:${failingSince}`,
      });
    }
  }

  async function sync(): Promise<void> {
    if (!ms) return;
    const row = await loadRow();
    if (row.status === 'off') return;
    const stored = readStored(row);

    let next: MsState;
    try {
      next = buildState(await new GraphClient(ms, deps.fetch, deps.sleep).fetchAll());
    } catch (e) {
      await recordFailure(row, stored, e);
      return;
    }

    const prev = stored.snapshot;
    const users = new Map((await deps.repo.msUsers.list()).map((u) => [u.graph_id, u]));
    const events = diffStates(prev, next, (id) => users.get(id)?.client_id != null);

    // Keep ms_users in step with the tenant.
    for (const [graphId, u] of Object.entries(next.users)) {
      await deps.repo.msUsers.upsert({ graph_id: graphId, upn: u.upn, display_name: u.name, sku_ids: u.skus });
    }
    const refreshed = new Map((await deps.repo.msUsers.list()).map((u) => [u.graph_id, u]));

    const eventKey = `ms:${row.last_sync_at ?? 'first'}`;
    for (const event of events) await raise(event, eventKey, refreshed, next, prev);

    // Linked users: keep their microsoft365 service in step (never touching manual data).
    for (const user of refreshed.values()) {
      if (user.client_id === null) continue;
      if (user.sku_ids.length > 0) await upsertUserService(user, user.client_id, next);
      else await archiveUserServices(user.graph_id, 'הוסר ממיקרוסופט');
    }
    // Users deleted from the tenant.
    for (const graphId of users.keys()) {
      if (next.users[graphId]) continue;
      await archiveUserServices(graphId, 'הוסר ממיקרוסופט');
      await deps.repo.msUsers.remove(graphId);
    }

    if (stored.failingSince && row.consecutive_failures >= FAILURES_BEFORE_ALERT) {
      await notify(deps, {
        kind: 'ms_connection',
        ...texts.microsoftRecovered(),
        deepLink: '/settings',
        dedupeKey: `ms-recovered:${stored.failingSince}`,
      });
    }
    await deps.repo.integrations.save({
      ...row,
      tenant_id: ms.tenantId,
      status: 'ok',
      last_sync_at: deps.now().toISOString(),
      last_error: null,
      consecutive_failures: 0,
      state_json: JSON.stringify({ snapshot: next, failingSince: null } satisfies Stored),
    });
    deps.log.info('microsoft.synced', { events: events.length, first: prev === null });
  }

  async function clientName(user: MsUser | undefined, fallback: string): Promise<{ name: string; client: Client | null }> {
    const client = user?.client_id ? await deps.repo.clients.get(user.client_id) : null;
    return { name: client?.name ?? user?.display_name ?? fallback, client };
  }

  async function raise(
    event: MsEvent,
    eventKey: string,
    users: Map<string, MsUser>,
    next: MsState,
    prev: MsState | null,
  ): Promise<void> {
    switch (event.type) {
      case 'licenses_bought':
        await notify(deps, {
          kind: 'ms_licenses',
          ...texts.licensesBought(event.total, event.free),
          deepLink: '/',
          dedupeKey: `${eventKey}:sku:${event.skuId}:${event.total}`,
        });
        return;
      case 'licenses_reduced':
        await notify(deps, {
          kind: 'ms_licenses',
          ...texts.licensesReduced(event.total),
          deepLink: '/',
          dedupeKey: `${eventKey}:sku:${event.skuId}:${event.total}`,
        });
        return;
      case 'subscription_status': {
        const text =
          event.status === 'Warning'
            ? texts.subscriptionWarning()
            : event.status === 'Suspended'
              ? texts.subscriptionSuspended()
              : event.status === 'Deleted'
                ? texts.subscriptionDeleted(event.name)
                : texts.subscriptionEnabled(event.name);
        await notify(deps, {
          kind: 'ms_subscription',
          ...text,
          deepLink: '/settings',
          dedupeKey: `${eventKey}:sub:${event.subId}:${event.status}`,
        });
        return;
      }
      case 'new_user':
        await notify(deps, {
          kind: 'ms_new_user',
          ...texts.newUser(),
          deepLink: `/assign/${encodeURIComponent(event.graphId)}`,
          dedupeKey: `${eventKey}:new:${event.graphId}`,
        });
        return;
      case 'license_assigned': {
        const user = users.get(event.graphId);
        const { name, client } = await clientName(user, next.users[event.graphId]?.name ?? '');
        await notify(deps, {
          kind: 'ms_license_user',
          ...texts.licenseAssigned(name),
          deepLink: client ? `/client/${client.id}` : `/assign/${encodeURIComponent(event.graphId)}`,
          dedupeKey: `${eventKey}:assigned:${event.graphId}:${event.skuIds.join(',')}`,
        });
        return;
      }
      case 'license_removed': {
        const user = users.get(event.graphId);
        const fallback = next.users[event.graphId]?.name ?? prev?.users[event.graphId]?.name ?? '';
        const { name, client } = await clientName(user, fallback);
        await notify(deps, {
          kind: 'ms_license_user',
          ...texts.licenseRemoved(name),
          deepLink: client ? `/client/${client.id}` : '/',
          dedupeKey: `${eventKey}:removed:${event.graphId}:${event.skuIds.join(',')}`,
        });
        return;
      }
    }
  }

  /** The renewal date of a user's licenses: the earliest next lifecycle date of their subscriptions. */
  function renewalFor(skuIds: string[], state: MsState | null): string {
    const dates = Object.values(state?.subs ?? {})
      .filter((s) => skuIds.includes(s.skuId) && s.next && s.status !== 'Deleted')
      .map((s) => israelDate(new Date(s.next!)))
      .sort();
    return dates[0] ?? defaultRenewalDate(israelDate(deps.now()), 'yearly');
  }

  function labelFor(user: MsUser, state: MsState | null): string {
    const names = user.sku_ids.map((id) => state?.skus[id]?.name).filter(Boolean);
    return names.length > 0 ? `${user.display_name} (${names.join(', ')})` : user.display_name;
  }

  async function archiveUserServices(graphId: string, reason: string): Promise<void> {
    for (const s of await deps.repo.services.findExternal('microsoft', graphId)) {
      if (!s.archived_at) await archiveService(deps, s.id, reason);
    }
  }

  /** Creates or updates the client's microsoft365 service for this user. */
  async function upsertUserService(user: MsUser, clientId: number, state: MsState | null): Promise<void> {
    const renewal = renewalFor(user.sku_ids, state);
    const label = labelFor(user, state);
    const existing = await deps.repo.services.findExternal('microsoft', user.graph_id);
    const mine = existing.find((s) => s.client_id === clientId);
    for (const other of existing) {
      if (other.client_id !== clientId && !other.archived_at) await archiveService(deps, other.id, 'הועבר ללקוח אחר');
    }
    if (!mine) {
      await createService(
        deps,
        clientId,
        { type: 'microsoft365', label, renewal_date: renewal, cycle: 'yearly' },
        { source: 'microsoft', external_ref: user.graph_id },
      );
      return;
    }
    const current = fromStoredDate(mine.renewal_date);
    // Only the renewal date (moving forward), label and archive state follow Microsoft.
    await deps.repo.services.update(mine.id, {
      label,
      archived_at: null,
      ...(renewal > current ? { renewal_date: toStoredDate(renewal) } : {}),
    });
  }

  const integration = {
    type: MICROSOFT,
    configured: ms !== null,
    sync,

    async describe(): Promise<MicrosoftSummary> {
      const row = await loadRow();
      const stored = readStored(row);
      const totals = licenseTotals(stored.snapshot);
      const connected = ms !== null && row.status !== 'off';
      return {
        configured: ms !== null,
        connected,
        status: connected ? row.status : 'off',
        last_sync_at: row.last_sync_at,
        last_error: row.last_error,
        consecutive_failures: row.consecutive_failures,
        licenses_total: totals.total,
        licenses_used: totals.used,
        unassigned_users: connected ? await deps.repo.msUsers.countUnassigned() : 0,
        secret_expires_at: ms?.secretExpiresAt ?? null,
      };
    },

    /** Turns syncing on. The first sync only records the state (sends nothing). */
    async connect(): Promise<void> {
      if (!ms) return;
      const row = await loadRow();
      // Connecting again after a disconnect starts fresh, so nothing old is re-announced.
      await deps.repo.integrations.save({
        ...emptyRow(ms.tenantId),
        status: 'ok',
        last_sync_at: row.status === 'off' ? null : row.last_sync_at,
        state_json: row.status === 'off' ? null : row.state_json,
      });
      await sync();
    },

    async disconnect(): Promise<void> {
      await deps.repo.integrations.save(emptyRow(ms?.tenantId ?? null));
    },

    /**
     * "למי שייך?": links a Microsoft user to a client and creates or updates that
     * client's microsoft365 service (source = microsoft, external_ref = graph id).
     */
    async link(graphId: string, clientId: number): Promise<void> {
      const user = await deps.repo.msUsers.get(graphId);
      if (!user) throw new HttpError(404, 'not_found', 'המשתמש לא נמצא');
      await deps.repo.msUsers.setClient(graphId, clientId);
      await deps.repo.history.add({
        client_id: clientId,
        service_id: null,
        text: `שויך משתמש מיקרוסופט ${user.display_name}`,
        created_at: deps.now().toISOString(),
      });
      if (user.sku_ids.length > 0) await upsertUserService(user, clientId, readStored(await loadRow()).snapshot);
    },
  } satisfies Integration & Record<string, unknown>;
  return integration;
}

export type MicrosoftIntegration = ReturnType<typeof createMicrosoftIntegration>;
