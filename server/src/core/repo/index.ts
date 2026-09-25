import {
  DEFAULT_CITY,
  type Client,
  type Cycle,
  type HistoryEntry,
  type MsUser,
  type Payment,
  type Service,
  type ServiceSource,
  type Settings,
} from '@renewals/shared';
import { stmt, type Db, type SqlValue, type Statement } from '../db';

/** Repository layer: every SQL statement of the app lives here. */

interface ServiceRow extends Omit<Service, 'auto_renew'> {
  auto_renew: number;
}

interface MsUserRow extends Omit<MsUser, 'sku_ids'> {
  sku_ids: string;
}

export interface NotificationRow {
  id: number;
  kind: string;
  title: string;
  body: string;
  deep_link: string;
  data_json: string | null;
  dedupe_key: string;
  status: 'queued' | 'sent' | 'failed';
  held: number;
  attempts: number;
  created_at: string;
  sent_at: string | null;
}

export interface SessionRow {
  id: number;
  token_hash: string;
  kind: 'web' | 'app';
  created_at: string;
  last_seen_at: string;
  expires_at: string;
}

export interface IntegrationRow {
  type: string;
  tenant_id: string | null;
  status: 'off' | 'ok' | 'error';
  last_sync_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  state_json: string | null;
}

export interface NewService {
  client_id: number;
  type: string;
  label: string | null;
  quantity: number;
  renewal_date: string;
  anchor_day: number | null;
  cycle: Cycle;
  cost_agorot: number;
  price_agorot: number;
  paid_until: string | null;
  auto_renew: boolean;
  source: ServiceSource;
  external_ref: string | null;
  note: string | null;
  archived_at?: string | null;
}

export type ServicePatch = Partial<Omit<NewService, 'client_id' | 'source'>>;

const toService = (r: ServiceRow): Service => ({ ...r, auto_renew: r.auto_renew === 1 });
const toMsUser = (r: MsUserRow): MsUser => ({ ...r, sku_ids: JSON.parse(r.sku_ids) as string[] });

const CLIENT_COLUMNS = ['name', 'phone', 'note', 'archived_at'] as const;

const SERVICE_COLUMNS = [
  'type',
  'label',
  'quantity',
  'renewal_date',
  'anchor_day',
  'cycle',
  'cost_agorot',
  'price_agorot',
  'paid_until',
  'auto_renew',
  'external_ref',
  'note',
  'archived_at',
] as const;

function sqlValue(v: unknown): SqlValue {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === undefined) return null;
  return v as SqlValue;
}

export const SETTING_KEYS = {
  quietEnabled: 'quiet_hours_enabled',
  quietCity: 'quiet_hours_city',
  dailyLastRun: 'daily_last_run_date',
  secretLastCheck: 'ms_secret_last_check_date',
} as const;

export function createRepo(db: Db) {
  const settings = {
    async get(key: string): Promise<string | null> {
      const row = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
      return row?.value ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      await db.run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value],
      );
    },
    async all(): Promise<Settings> {
      const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
      const map = new Map(rows.map((r) => [r.key, r.value]));
      return {
        quiet_hours_enabled: map.get(SETTING_KEYS.quietEnabled) !== '0',
        quiet_hours_city: map.get(SETTING_KEYS.quietCity) ?? DEFAULT_CITY,
      };
    },
  };

  const clients = {
    list(): Promise<Client[]> {
      return db.all<Client>('SELECT * FROM clients ORDER BY name');
    },
    get(id: number): Promise<Client | null> {
      return db.first<Client>('SELECT * FROM clients WHERE id = ?', [id]);
    },
    async create(input: { name: string; phone: string | null; note: string | null }, now: string): Promise<Client> {
      const r = await db.run('INSERT INTO clients (name, phone, note, created_at) VALUES (?, ?, ?, ?)', [
        input.name,
        input.phone,
        input.note,
        now,
      ]);
      return (await clients.get(r.lastRowId))!;
    },
    async update(id: number, patch: Partial<Pick<Client, 'name' | 'phone' | 'note' | 'archived_at'>>): Promise<void> {
      const entries = CLIENT_COLUMNS.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]] as const);
      if (entries.length === 0) return;
      await db.run(`UPDATE clients SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`, [
        ...entries.map(([, v]) => sqlValue(v)),
        id,
      ]);
    },
  };

  const services = {
    async list(): Promise<Service[]> {
      return (await db.all<ServiceRow>('SELECT * FROM services ORDER BY renewal_date')).map(toService);
    },
    async listActive(): Promise<Service[]> {
      return (
        await db.all<ServiceRow>('SELECT * FROM services WHERE archived_at IS NULL ORDER BY renewal_date')
      ).map(toService);
    },
    async listForClient(clientId: number): Promise<Service[]> {
      return (
        await db.all<ServiceRow>(
          'SELECT * FROM services WHERE client_id = ? AND archived_at IS NULL ORDER BY renewal_date',
          [clientId],
        )
      ).map(toService);
    },
    async get(id: number): Promise<Service | null> {
      const row = await db.first<ServiceRow>('SELECT * FROM services WHERE id = ?', [id]);
      return row ? toService(row) : null;
    },
    async findExternal(source: ServiceSource, ref: string): Promise<Service[]> {
      return (
        await db.all<ServiceRow>('SELECT * FROM services WHERE source = ? AND external_ref = ? ORDER BY id', [
          source,
          ref,
        ])
      ).map(toService);
    },
    async create(input: NewService, now: string): Promise<Service> {
      const r = await db.run(
        `INSERT INTO services (client_id, type, label, quantity, renewal_date, anchor_day, cycle, cost_agorot,
           price_agorot, paid_until, auto_renew, source, external_ref, note, archived_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.client_id,
          input.type,
          input.label,
          input.quantity,
          input.renewal_date,
          input.anchor_day,
          input.cycle,
          input.cost_agorot,
          input.price_agorot,
          input.paid_until,
          input.auto_renew ? 1 : 0,
          input.source,
          input.external_ref,
          input.note,
          input.archived_at ?? null,
          now,
        ],
      );
      return (await services.get(r.lastRowId))!;
    },
    /** `whereRenewalDate`: only update while the renewal date is still this value. */
    updateStatement(id: number, patch: ServicePatch, whereRenewalDate?: string): Statement | null {
      const entries = SERVICE_COLUMNS.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]] as const);
      if (entries.length === 0) return null;
      return stmt(
        `UPDATE services SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?${
          whereRenewalDate === undefined ? '' : ' AND renewal_date = ?'
        }`,
        ...entries.map(([, v]) => sqlValue(v)),
        id,
        ...(whereRenewalDate === undefined ? [] : [whereRenewalDate]),
      );
    },
    async update(id: number, patch: ServicePatch): Promise<void> {
      const s = services.updateStatement(id, patch);
      if (s) await db.run(s.sql, s.params);
    },
  };

  const payments = {
    /** `onlyIfPreviousChanged`: insert only when the previous statement in the batch changed a row. */
    insertStatement(p: Omit<Payment, 'id'>, onlyIfPreviousChanged = false): Statement {
      return stmt(
        `INSERT INTO payments (service_id, amount_agorot, paid_at, covers_until) SELECT ?, ?, ?, ?${
          onlyIfPreviousChanged ? ' WHERE changes() = 1' : ''
        }`,
        p.service_id,
        p.amount_agorot,
        p.paid_at,
        p.covers_until,
      );
    },
    list(): Promise<Payment[]> {
      return db.all<Payment>('SELECT * FROM payments ORDER BY id');
    },
    listForService(serviceId: number): Promise<Payment[]> {
      return db.all<Payment>('SELECT * FROM payments WHERE service_id = ? ORDER BY paid_at DESC', [serviceId]);
    },
  };

  const history = {
    insertStatement(e: Omit<HistoryEntry, 'id'>, onlyIfPreviousChanged = false): Statement {
      return stmt(
        `INSERT INTO history (client_id, service_id, text, created_at) SELECT ?, ?, ?, ?${
          onlyIfPreviousChanged ? ' WHERE changes() = 1' : ''
        }`,
        e.client_id,
        e.service_id,
        e.text,
        e.created_at,
      );
    },
    async add(e: Omit<HistoryEntry, 'id'>): Promise<void> {
      const s = history.insertStatement(e);
      await db.run(s.sql, s.params);
    },
    listForClient(clientId: number, limit: number): Promise<HistoryEntry[]> {
      return db.all<HistoryEntry>(
        'SELECT * FROM history WHERE client_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
        [clientId, limit],
      );
    },
    list(): Promise<HistoryEntry[]> {
      return db.all<HistoryEntry>('SELECT * FROM history ORDER BY id');
    },
  };

  const notifications = {
    /** Inserts a queued notification; returns false when the dedupe key already exists. */
    async enqueue(n: {
      kind: string;
      title: string;
      body: string;
      deep_link: string;
      data?: Record<string, unknown> | null;
      dedupe_key: string;
      held: boolean;
      created_at: string;
    }): Promise<boolean> {
      const r = await db.run(
        `INSERT INTO notifications (kind, title, body, deep_link, data_json, dedupe_key, held, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(dedupe_key) DO NOTHING`,
        [
          n.kind,
          n.title,
          n.body,
          n.deep_link,
          n.data ? JSON.stringify(n.data) : null,
          n.dedupe_key,
          n.held ? 1 : 0,
          n.created_at,
        ],
      );
      return r.changes > 0;
    },
    exists(dedupeKey: string): Promise<{ id: number } | null> {
      return db.first<{ id: number }>('SELECT id FROM notifications WHERE dedupe_key = ?', [dedupeKey]);
    },
    listQueued(): Promise<NotificationRow[]> {
      return db.all<NotificationRow>("SELECT * FROM notifications WHERE status = 'queued' ORDER BY created_at, id");
    },
    list(): Promise<NotificationRow[]> {
      return db.all<NotificationRow>('SELECT * FROM notifications ORDER BY id');
    },
    async markSent(ids: number[], now: string): Promise<void> {
      if (ids.length === 0) return;
      await db.run(
        `UPDATE notifications SET status = 'sent', sent_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
        [now, ...ids],
      );
    },
    async markAttempt(ids: number[], maxAttempts: number): Promise<void> {
      if (ids.length === 0) return;
      const list = ids.map(() => '?').join(',');
      await db.batch([
        stmt(`UPDATE notifications SET attempts = attempts + 1 WHERE id IN (${list})`, ...ids),
        stmt(
          `UPDATE notifications SET status = 'failed' WHERE id IN (${list}) AND attempts >= ?`,
          ...ids,
          maxAttempts,
        ),
      ]);
    },
  };

  const pushTokens = {
    async add(token: string, now: string): Promise<void> {
      await db.run('INSERT INTO push_tokens (token, created_at) VALUES (?, ?) ON CONFLICT(token) DO NOTHING', [
        token,
        now,
      ]);
    },
    async remove(token: string): Promise<void> {
      await db.run('DELETE FROM push_tokens WHERE token = ?', [token]);
    },
    async list(): Promise<string[]> {
      return (await db.all<{ token: string }>('SELECT token FROM push_tokens ORDER BY created_at')).map((r) => r.token);
    },
  };

  const sessions = {
    async create(s: Omit<SessionRow, 'id'>): Promise<void> {
      await db.run(
        'INSERT INTO sessions (token_hash, kind, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        [s.token_hash, s.kind, s.created_at, s.last_seen_at, s.expires_at],
      );
    },
    findByHash(hash: string): Promise<SessionRow | null> {
      return db.first<SessionRow>('SELECT * FROM sessions WHERE token_hash = ?', [hash]);
    },
    async touch(id: number, lastSeen: string, expiresAt: string): Promise<void> {
      await db.run('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?', [lastSeen, expiresAt, id]);
    },
    async deleteByHash(hash: string): Promise<void> {
      await db.run('DELETE FROM sessions WHERE token_hash = ?', [hash]);
    },
    async deleteExpired(now: string): Promise<void> {
      await db.run('DELETE FROM sessions WHERE expires_at <= ?', [now]);
    },
  };

  const integrations = {
    get(type: string): Promise<IntegrationRow | null> {
      return db.first<IntegrationRow>('SELECT * FROM integrations WHERE type = ?', [type]);
    },
    async save(row: IntegrationRow): Promise<void> {
      await db.run(
        `INSERT INTO integrations (type, tenant_id, status, last_sync_at, last_error, consecutive_failures, state_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(type) DO UPDATE SET tenant_id = excluded.tenant_id, status = excluded.status,
           last_sync_at = excluded.last_sync_at, last_error = excluded.last_error,
           consecutive_failures = excluded.consecutive_failures, state_json = excluded.state_json`,
        [
          row.type,
          row.tenant_id,
          row.status,
          row.last_sync_at,
          row.last_error,
          row.consecutive_failures,
          row.state_json,
        ],
      );
    },
  };

  const msUsers = {
    async list(): Promise<MsUser[]> {
      return (await db.all<MsUserRow>('SELECT * FROM ms_users ORDER BY display_name')).map(toMsUser);
    },
    async get(graphId: string): Promise<MsUser | null> {
      const row = await db.first<MsUserRow>('SELECT * FROM ms_users WHERE graph_id = ?', [graphId]);
      return row ? toMsUser(row) : null;
    },
    async upsert(u: Omit<MsUser, 'client_id'>): Promise<void> {
      await db.run(
        `INSERT INTO ms_users (graph_id, upn, display_name, sku_ids) VALUES (?, ?, ?, ?)
         ON CONFLICT(graph_id) DO UPDATE SET upn = excluded.upn, display_name = excluded.display_name,
           sku_ids = excluded.sku_ids`,
        [u.graph_id, u.upn, u.display_name, JSON.stringify(u.sku_ids)],
      );
    },
    async setClient(graphId: string, clientId: number | null): Promise<void> {
      await db.run('UPDATE ms_users SET client_id = ? WHERE graph_id = ?', [clientId, graphId]);
    },
    async remove(graphId: string): Promise<void> {
      await db.run('DELETE FROM ms_users WHERE graph_id = ?', [graphId]);
    },
    async countUnassigned(): Promise<number> {
      const row = await db.first<{ n: number }>(
        "SELECT COUNT(*) AS n FROM ms_users WHERE client_id IS NULL AND sku_ids != '[]'",
      );
      return row?.n ?? 0;
    },
  };

  return {
    db,
    settings,
    clients,
    services,
    payments,
    history,
    notifications,
    pushTokens,
    sessions,
    integrations,
    msUsers,
  };
}

export type Repo = ReturnType<typeof createRepo>;
