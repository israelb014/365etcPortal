import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Db, RunResult, SqlValue, Statement } from '../../src/core/db';

const MIGRATIONS = join(__dirname, '..', '..', 'migrations');

/** An in-memory SQLite database with every migration applied, behind the Db interface. */
export function createTestDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    raw.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }
  const run = (sql: string, params: SqlValue[] = []): RunResult => {
    const r = raw.prepare(sql).run(...params);
    return { changes: Number(r.changes), lastRowId: Number(r.lastInsertRowid) };
  };
  return {
    raw,
    async all<T>(sql: string, params: SqlValue[] = []) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async first<T>(sql: string, params: SqlValue[] = []) {
      return (raw.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async run(sql: string, params?: SqlValue[]) {
      return run(sql, params);
    },
    async batch(statements: Statement[]) {
      raw.exec('BEGIN');
      try {
        const out = statements.map((s) => run(s.sql, s.params));
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
