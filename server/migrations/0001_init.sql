-- Released migrations are never edited. Add a new numbered file instead.
-- Money: integer agorot. Instants: UTC ISO strings.
-- Calendar dates (renewal_date, paid_until, covers_until): 'YYYY-MM-DDT00:00:00.000Z',
-- where the date part is the Israel (Asia/Jerusalem) date.

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  note TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  type TEXT NOT NULL,
  label TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  renewal_date TEXT NOT NULL,
  anchor_day INTEGER,
  cycle TEXT NOT NULL CHECK (cycle IN ('monthly', 'yearly', 'once')),
  cost_agorot INTEGER NOT NULL DEFAULT 0,
  price_agorot INTEGER NOT NULL DEFAULT 0,
  paid_until TEXT,
  auto_renew INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'microsoft')),
  external_ref TEXT,
  note TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX services_client ON services(client_id);
CREATE INDEX services_external ON services(source, external_ref);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL REFERENCES services(id),
  amount_agorot INTEGER NOT NULL,
  paid_at TEXT NOT NULL,
  covers_until TEXT NOT NULL
);
CREATE INDEX payments_service ON payments(service_id);

CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id),
  service_id INTEGER REFERENCES services(id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX history_client ON history(client_id, created_at);

CREATE TABLE integrations (
  type TEXT PRIMARY KEY,
  tenant_id TEXT,
  status TEXT NOT NULL DEFAULT 'off',
  last_sync_at TEXT,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  state_json TEXT
);

CREATE TABLE ms_users (
  graph_id TEXT PRIMARY KEY,
  upn TEXT NOT NULL,
  display_name TEXT NOT NULL,
  sku_ids TEXT NOT NULL DEFAULT '[]',
  client_id INTEGER REFERENCES clients(id)
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  deep_link TEXT NOT NULL,
  data_json TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  held INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX notifications_status ON notifications(status, created_at);

CREATE TABLE push_tokens (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('web', 'app')),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
