import { CYCLES, isServiceType, isValidDateOnly, type Cycle } from '@renewals/shared';
import { HttpError } from './http';

/** Small input validators. Every failure is a 400 with a Hebrew message. */

export function bad(message = 'נתונים לא תקינים'): never {
  throw new HttpError(400, 'invalid', message);
}

export type Body = Record<string, unknown>;

export function asBody(value: unknown): Body {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad();
  return value as Body;
}

export function text(body: Body, key: string, opts: { required: true; max: number }): string;
export function text(body: Body, key: string, opts: { required?: false; max: number }): string | null | undefined;
export function text(body: Body, key: string, opts: { required?: boolean; max: number }) {
  const v = body[key];
  if (v === undefined) return opts.required ? bad(`חסר ${key}`) : undefined;
  if (v === null) return opts.required ? bad(`חסר ${key}`) : null;
  if (typeof v !== 'string') bad();
  const t = v.trim();
  if (t.length > opts.max) bad('הטקסט ארוך מדי');
  if (opts.required && t.length === 0) bad('צריך למלא שם');
  return opts.required ? t : t || null;
}

export function int(body: Body, key: string, min: number, max: number): number | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) bad();
  return v;
}

export function bool(body: Body, key: string): boolean | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') bad();
  return v;
}

export function date(body: Body, key: string): string | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (!isValidDateOnly(v)) bad('תאריך לא תקין');
  return v;
}

export function cycle(body: Body, key: string): Cycle | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !(CYCLES as readonly string[]).includes(v)) bad();
  return v as Cycle;
}

export function serviceType(body: Body, key: string): string | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (!isServiceType(v)) bad('סוג שירות לא מוכר');
  return v;
}

export function idParam(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, 'not_found', 'לא נמצא');
  return n;
}

export const MAX_AGOROT = 100_000_000_00;
