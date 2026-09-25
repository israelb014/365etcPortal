import { describe, expect, it } from 'vitest';
import {
  addMonths,
  addYears,
  daysBetween,
  formatDate,
  fromStoredDate,
  israelDate,
  israelParts,
  israelTimeToInstant,
  isValidDateOnly,
  toStoredDate,
} from '../src/dates';

describe('israel time', () => {
  it('matches Intl for every hour across two years (DST edges included)', () => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    const start = Date.UTC(2025, 0, 1);
    const end = Date.UTC(2027, 0, 1);
    for (let t = start; t < end; t += 3_600_000) {
      const parts = Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
      const mine = israelParts(new Date(t));
      expect(`${mine.date} ${mine.hour}`).toBe(
        `${parts.year}-${parts.month}-${parts.day} ${Number(parts.hour)}`,
      );
    }
  });

  it('converts wall clock to instant', () => {
    expect(israelTimeToInstant('2026-01-15', 9, 0).toISOString()).toBe('2026-01-15T07:00:00.000Z');
    expect(israelTimeToInstant('2026-07-15', 9, 0).toISOString()).toBe('2026-07-15T06:00:00.000Z');
  });

  it('israelDate crosses midnight in Israel before UTC', () => {
    expect(israelDate(new Date('2026-07-14T21:30:00Z'))).toBe('2026-07-15');
    expect(israelDate(new Date('2026-01-14T21:30:00Z'))).toBe('2026-01-14');
  });
});

describe('calendar math', () => {
  it('Jan 31 + 1 month = Feb 28 / Feb 29 in a leap year', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('keeps the anchor day after a short month', () => {
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonths('2026-03-31', 1, 31)).toBe('2026-04-30');
  });

  it('Feb 29 + 1 year = Feb 28', () => {
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28');
  });

  it('crosses year ends', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('stores and formats dates', () => {
    expect(toStoredDate('2026-03-05')).toBe('2026-03-05T00:00:00.000Z');
    expect(fromStoredDate('2026-03-05T00:00:00.000Z')).toBe('2026-03-05');
    expect(formatDate('2026-03-05T00:00:00.000Z')).toBe('05/03/2026');
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2);
  });

  it('validates dates', () => {
    expect(isValidDateOnly('2026-02-29')).toBe(false);
    expect(isValidDateOnly('2028-02-29')).toBe(true);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
    expect(isValidDateOnly('26-01-01')).toBe(false);
  });
});
