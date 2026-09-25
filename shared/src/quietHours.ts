import { HDate, HebrewCalendar, Location, Zmanim, flags } from '@hebcal/core';
import { findCity } from './cities';
import { addDays, israelDate, israelParts, splitDate, type DateOnly } from './dates';

/**
 * Quiet hours: 23:00–07:00 every night, and Shabbat / Yom Tov (Israel schedule)
 * from 60 minutes before sunset until 82 minutes after sunset at the end.
 * Kept in `shared/` (pure) and imported separately so the app bundle doesn't
 * carry @hebcal/core.
 */
export const NIGHT_START_HOUR = 23;
export const NIGHT_END_HOUR = 7;
export const MINUTES_BEFORE_SUNSET = 60;
export const MINUTES_AFTER_SUNSET = 82;

export interface QuietSettings {
  enabled: boolean;
  city: string;
}

export function isNight(now: Date): boolean {
  const { hour } = israelParts(now);
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

function localDate(date: DateOnly): Date {
  const [y, m, d] = splitDate(date);
  return new Date(y, m - 1, d, 12);
}

/** Shabbat or an Israeli Yom Tov (a day on which work is forbidden). */
export function isHolyDay(date: DateOnly): boolean {
  const [y, m, d] = splitDate(date);
  if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 6) return true;
  const events = HebrewCalendar.getHolidaysOnDate(new HDate(localDate(date)), true) ?? [];
  return events.some((e) => (e.getFlags() & flags.CHAG) !== 0);
}

function sunset(date: DateOnly, city: string): Date {
  const c = findCity(city);
  const location = new Location(c.lat, c.lon, true, 'Asia/Jerusalem', c.name, 'IL');
  return new Zmanim(location, localDate(date), false).sunset();
}

/** The quiet window of a holy day: [sunset of the eve − 60m, sunset + 82m). */
export function holyWindow(date: DateOnly, city: string): { start: Date; end: Date } {
  const start = new Date(sunset(addDays(date, -1), city).getTime() - MINUTES_BEFORE_SUNSET * 60_000);
  const end = new Date(sunset(date, city).getTime() + MINUTES_AFTER_SUNSET * 60_000);
  return { start, end };
}

export function isHolyTime(now: Date, city: string): boolean {
  const today = israelDate(now);
  for (const day of [today, addDays(today, 1)]) {
    if (!isHolyDay(day)) continue;
    const { start, end } = holyWindow(day, city);
    if (now >= start && now < end) return true;
  }
  return false;
}

export function isQuietTime(now: Date, settings: QuietSettings): boolean {
  if (!settings.enabled) return false;
  return isNight(now) || isHolyTime(now, settings.city);
}
