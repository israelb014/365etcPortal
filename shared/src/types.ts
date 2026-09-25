/** Types shared by the API (server) and the app. Field names match the API JSON. */

export type Cycle = 'monthly' | 'yearly' | 'once';
export const CYCLES: readonly Cycle[] = ['monthly', 'yearly', 'once'];
export const CYCLE_NAMES: Record<Cycle, string> = {
  monthly: 'חודשי',
  yearly: 'שנתי',
  once: 'חד פעמי',
};

export type ServiceSource = 'manual' | 'microsoft';

export type Status = 'unpaid' | 'pending' | 'paid';

export const STATUS_NAMES: Record<Status, string> = {
  unpaid: 'לא שולם',
  pending: 'ממתין',
  paid: 'שולם',
};

export interface Client {
  id: number;
  name: string;
  phone: string | null;
  note: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface Service {
  id: number;
  client_id: number;
  type: string;
  label: string | null;
  quantity: number;
  /** Stored calendar date (`YYYY-MM-DDT00:00:00.000Z`). */
  renewal_date: string;
  /** Day of month the renewal is anchored to, so month ends don't drift. */
  anchor_day: number | null;
  cycle: Cycle;
  cost_agorot: number;
  price_agorot: number;
  /** The latest renewal date whose payment was recorded. */
  paid_until: string | null;
  auto_renew: boolean;
  source: ServiceSource;
  external_ref: string | null;
  note: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface Payment {
  id: number;
  service_id: number;
  amount_agorot: number;
  paid_at: string;
  covers_until: string;
}

export interface HistoryEntry {
  id: number;
  client_id: number | null;
  service_id: number | null;
  text: string;
  created_at: string;
}

export interface MicrosoftSummary {
  configured: boolean;
  connected: boolean;
  status: 'off' | 'ok' | 'error';
  last_sync_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  licenses_total: number;
  licenses_used: number;
  unassigned_users: number;
  secret_expires_at: string | null;
}

/** GET /api/v1/snapshot — everything the home screen needs. */
export interface Snapshot {
  clients: Client[];
  services: Service[];
  microsoft: MicrosoftSummary;
  server_time: string;
}

export interface ClientDetail {
  client: Client;
  services: Service[];
  history: HistoryEntry[];
}

export interface MsUser {
  graph_id: string;
  upn: string;
  display_name: string;
  sku_ids: string[];
  client_id: number | null;
}

export interface MsUserDetail {
  user: MsUser;
  licenses: string[];
  suggestions: Client[];
  clients: Client[];
}

export interface Settings {
  quiet_hours_enabled: boolean;
  quiet_hours_city: string;
}

export interface VersionInfo {
  server_version: string;
  min_app_version: string;
  apk_url: string | null;
}

export interface NewClientInput {
  name: string;
  phone?: string | null;
  note?: string | null;
}

export interface ServiceInput {
  client_id: number;
  type: string;
  label?: string | null;
  quantity?: number;
  /** `YYYY-MM-DD` */
  renewal_date: string;
  cycle?: Cycle;
  cost_agorot?: number;
  price_agorot?: number;
  auto_renew?: boolean;
  note?: string | null;
}
