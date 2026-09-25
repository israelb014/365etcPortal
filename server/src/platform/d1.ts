import type { Db, RunResult, SqlValue, Statement } from '../core/db';

/** Db implementation on Cloudflare D1. */
export function d1Db(d1: D1Database): Db {
  const prepare = (sql: string, params: SqlValue[] = []) => d1.prepare(sql).bind(...params);
  const toRun = (meta: { changes?: number; last_row_id?: number }): RunResult => ({
    changes: meta.changes ?? 0,
    lastRowId: meta.last_row_id ?? 0,
  });
  return {
    async all<T>(sql: string, params?: SqlValue[]) {
      const res = await prepare(sql, params).all<T>();
      return res.results;
    },
    async first<T>(sql: string, params?: SqlValue[]) {
      return (await prepare(sql, params).first<T>()) ?? null;
    },
    async run(sql: string, params?: SqlValue[]) {
      const res = await prepare(sql, params).run();
      return toRun(res.meta);
    },
    async batch(statements: Statement[]) {
      if (statements.length === 0) return [];
      const res = await d1.batch(statements.map((s) => prepare(s.sql, s.params)));
      return res.map((r) => toRun(r.meta));
    },
  };
}
