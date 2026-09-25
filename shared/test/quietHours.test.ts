import { describe, expect, it } from 'vitest';
import { israelTimeToInstant } from '../src/dates';
import { holyWindow, isHolyDay, isQuietTime } from '../src/quietHours';

const on = { enabled: true, city: 'רמלה' };
const at = (date: string, h: number, m = 0) => israelTimeToInstant(date, h, m);

describe('quiet hours — night', () => {
  it('is quiet 23:00–07:00 on a weekday', () => {
    expect(isQuietTime(at('2026-10-20', 22, 59), on)).toBe(false);
    expect(isQuietTime(at('2026-10-20', 23, 0), on)).toBe(true);
    expect(isQuietTime(at('2026-10-21', 6, 59), on)).toBe(true);
    expect(isQuietTime(at('2026-10-21', 7, 0), on)).toBe(false);
  });

  it('is never quiet when disabled', () => {
    expect(isQuietTime(at('2026-10-21', 3, 0), { ...on, enabled: false })).toBe(false);
    expect(isQuietTime(at('2026-10-17', 12, 0), { ...on, enabled: false })).toBe(false);
  });
});

describe('quiet hours — regular Shabbat (16–17 Oct 2026, Ramla)', () => {
  const { start, end } = holyWindow('2026-10-17', 'רמלה');

  it('window starts 60 minutes before Friday sunset and ends 82 minutes after Saturday sunset', () => {
    // Ramla sunset ≈ 18:07 on Friday 16 Oct, ≈ 18:06 on Saturday 17 Oct (IDT).
    expect(start.getTime()).toBeGreaterThan(at('2026-10-16', 16, 55).getTime());
    expect(start.getTime()).toBeLessThan(at('2026-10-16', 17, 20).getTime());
    expect(end.getTime()).toBeGreaterThan(at('2026-10-17', 19, 15).getTime());
    expect(end.getTime()).toBeLessThan(at('2026-10-17', 19, 40).getTime());
  });

  it('is quiet exactly inside the window', () => {
    expect(isQuietTime(new Date(start.getTime() - 60_000), on)).toBe(false);
    expect(isQuietTime(start, on)).toBe(true);
    expect(isQuietTime(at('2026-10-17', 12, 0), on)).toBe(true);
    expect(isQuietTime(new Date(end.getTime() - 60_000), on)).toBe(true);
    expect(isQuietTime(end, on)).toBe(false);
    expect(isQuietTime(at('2026-10-16', 12, 0), on)).toBe(false);
    expect(isQuietTime(at('2026-10-17', 21, 0), on)).toBe(false);
  });
});

describe('quiet hours — Rosh Hashana 5787 (Sat 12 – Sun 13 Sep 2026)', () => {
  it('knows the Yom Tov days', () => {
    expect(isHolyDay('2026-09-11')).toBe(false); // erev Rosh Hashana (Friday)
    expect(isHolyDay('2026-09-12')).toBe(true);
    expect(isHolyDay('2026-09-13')).toBe(true);
    expect(isHolyDay('2026-09-14')).toBe(false);
  });

  it('stays quiet from Friday before sunset until after Sunday night', () => {
    // Sunset in Ramla ≈ 18:52 Friday, ≈ 18:49 Sunday (IDT).
    expect(isQuietTime(at('2026-09-11', 17, 30), on)).toBe(false);
    expect(isQuietTime(at('2026-09-11', 18, 0), on)).toBe(true);
    expect(isQuietTime(at('2026-09-12', 12, 0), on)).toBe(true);
    expect(isQuietTime(at('2026-09-12', 20, 30), on)).toBe(true); // between the two days
    expect(isQuietTime(at('2026-09-13', 12, 0), on)).toBe(true);
    expect(isQuietTime(at('2026-09-13', 20, 5), on)).toBe(true);
    expect(isQuietTime(at('2026-09-13', 20, 20), on)).toBe(false);
    expect(isQuietTime(at('2026-09-14', 12, 0), on)).toBe(false);
  });
});
