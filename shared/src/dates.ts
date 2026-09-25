/**
 * Date helpers. All calendar logic happens in Asia/Jerusalem.
 *
 * Two kinds of values are stored:
 * - Instants (created_at, paid_at, sent_at): real UTC ISO strings.
 * - Calendar dates (renewal_date, paid_until, covers_until): the Israel calendar
 *   date written as `YYYY-MM-DDT00:00:00.000Z`. The date part *is* the Israel date,
 *   so it never shifts when converted.
 */

export const TIME_ZONE = 'Asia/Jerusalem';

/** A calendar date, `YYYY-MM-DD`. */
export type DateOnly = string;

const DAY_MS = 86_400_000;

const HOUR_MS = 3_600_000;

function lastSundayOfMonth(year: number, monthIndex: number): number {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return last.getUTCDate() - last.getUTCDay();
}

/**
 * Israel's UTC offset in ms at an instant. Uses the fixed rule of the 2013 law
 * (DST from the Friday before the last Sunday of March at 02:00 until the last
 * Sunday of October at 02:00) instead of `Intl`, so the result is identical on
 * Workers, Node and Hermes.
 */
export function israelOffsetMs(instantMs: number): number {
  const year = new Date(instantMs).getUTCFullYear();
  const dstStart = Date.UTC(year, 2, lastSundayOfMonth(year, 2) - 2, 0); // 02:00 IST
  const dstEnd = Date.UTC(year, 9, lastSundayOfMonth(year, 9)) - HOUR_MS; // 02:00 IDT
  return instantMs >= dstStart && instantMs < dstEnd ? 3 * HOUR_MS : 2 * HOUR_MS;
}

export interface ZonedParts {
  date: DateOnly;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Israel wall-clock parts of an instant. */
export function israelParts(instant: Date): ZonedParts {
  const local = new Date(instant.getTime() + israelOffsetMs(instant.getTime()));
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  return {
    date: `${pad4(year)}-${pad2(month)}-${pad2(day)}`,
    year,
    month,
    day,
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
  };
}

/** The Israel calendar date of an instant. */
export function israelDate(instant: Date): DateOnly {
  return israelParts(instant).date;
}

/** The UTC instant of an Israel wall-clock time on a date. */
export function israelTimeToInstant(date: DateOnly, hour: number, minute: number): Date {
  const [y, m, d] = splitDate(date);
  const wall = Date.UTC(y, m - 1, d, hour, minute);
  let result = wall - 2 * HOUR_MS;
  result = wall - israelOffsetMs(result);
  return new Date(result);
}

export function splitDate(date: DateOnly): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isValidDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = splitDate(value);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** `YYYY-MM-DD` → stored form. */
export function toStoredDate(date: DateOnly): string {
  const [y, m, d] = splitDate(date);
  return `${pad4(y)}-${pad2(m)}-${pad2(d)}T00:00:00.000Z`;
}

/** Stored form (or `YYYY-MM-DD`) → `YYYY-MM-DD`. */
export function fromStoredDate(stored: string): DateOnly {
  const [y, m, d] = splitDate(stored);
  return `${pad4(y)}-${pad2(m)}-${pad2(d)}`;
}

export function dayNumber(date: DateOnly): number {
  const [y, m, d] = splitDate(date);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(n: number): DateOnly {
  const dt = new Date(n * DAY_MS);
  return `${pad4(dt.getUTCFullYear())}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: DateOnly, b: DateOnly): number {
  return dayNumber(b) - dayNumber(a);
}

export function addDays(date: DateOnly, days: number): DateOnly {
  return fromDayNumber(dayNumber(date) + days);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Adds months, clamping to the month end (Jan 31 + 1 month = Feb 28/29).
 * `anchorDay` keeps the original day of month across short months
 * (Jan 31 → Feb 28 → Mar 31).
 */
export function addMonths(date: DateOnly, months: number, anchorDay?: number | null): DateOnly {
  const [y, m, d] = splitDate(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const wanted = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : d;
  const nd = Math.min(wanted, daysInMonth(ny, nm));
  return `${pad4(ny)}-${pad2(nm)}-${pad2(nd)}`;
}

export function addYears(date: DateOnly, years: number, anchorDay?: number | null): DateOnly {
  return addMonths(date, years * 12, anchorDay);
}

/** `dd/MM/yyyy`. */
export function formatDate(dateOrStored: string): string {
  const [y, m, d] = splitDate(dateOrStored);
  return `${pad2(d)}/${pad2(m)}/${pad4(y)}`;
}

/** `HH:mm` in Israel. */
export function formatTime(instant: Date): string {
  const p = israelParts(instant);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}
