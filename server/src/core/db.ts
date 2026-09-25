/**
 * The database seen by core logic. Implemented by D1 in production
 * (platform/d1.ts) and by node:sqlite in tests. SQLite dialect.
 */
export type SqlValue = string | number | null;

export interface Statement {
  sql: string;
  params: SqlValue[];
}

export interface RunResult {
  changes: number;
  lastRowId: number;
}

export interface Db {
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  /** Runs all statements in one transaction. */
  batch(statements: Statement[]): Promise<RunResult[]>;
}

export function stmt(sql: string, ...params: SqlValue[]): Statement {
  return { sql, params };
}
