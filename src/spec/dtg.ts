import type { Profile } from "../profile/types.js";

export type DtgFormat = Profile["dtg_format"];

export const MONTHS_UPPER: ReadonlyArray<string> = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** Maximum days per month (non-leap year; leap years get +1 for FEB at index 1). */
const MONTH_MAX_DAYS: ReadonlyArray<number> = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatBastionDTG(d: Date): string {
  const dd = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const mm = pad2(d.getUTCMinutes());
  const mon = MONTHS_UPPER[d.getUTCMonth()];
  const yy = pad2(d.getUTCFullYear() % 100);
  return `${dd}${hh}${mm}Z${mon}${yy}`;
}

export function formatDTG(d: Date, format: DtgFormat): string {
  if (format === "DDHHMMZMONYY") return formatBastionDTG(d);
  return d.toISOString();
}

export function nowDTG(format: DtgFormat, clock: () => Date = () => new Date()): string {
  return formatDTG(clock(), format);
}

/** Slugs with no parseable DTG sort last (oldest-at-bottom in descending recency order). */
const DTG_SORT_UNKNOWN = Number.NEGATIVE_INFINITY;

/**
 * Maps a status DTG string to a numeric recency key (UTC ms) for sorting.
 * Supports Bastion `DDHHMMZMONYY` and any `Date.parse`-accepted string (e.g. ISO-8601).
 * Empty or unparseable values return a sentinel so they sort after real timestamps.
 */
export function dtgToRecencySortKey(dtg: string): number {
  const s = dtg.trim();
  if (!s) return DTG_SORT_UNKNOWN;

  const bastion = /^(\d{2})(\d{2})(\d{2})Z([A-Z]{3})(\d{2})$/.exec(s);
  if (bastion) {
    const day = Number.parseInt(bastion[1] ?? "", 10);
    const hour = Number.parseInt(bastion[2] ?? "", 10);
    const minute = Number.parseInt(bastion[3] ?? "", 10);
    const monStr = bastion[4] ?? "";
    const yy = Number.parseInt(bastion[5] ?? "", 10);
    const month = MONTHS_UPPER.indexOf(monStr);
    if (
      month < 0 ||
      !Number.isFinite(day) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      !Number.isFinite(yy) ||
      day < 1 ||
      day > 31 ||
      hour > 23 ||
      minute > 59
    ) {
      return DTG_SORT_UNKNOWN;
    }
    const year = yy >= 70 ? 1900 + yy : 2000 + yy;
    // Validate day against the calendar month, accounting for leap years.
    const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const maxDay = (MONTH_MAX_DAYS[month] ?? 31) + (month === 1 && isLeap ? 1 : 0);
    if (day > maxDay) return DTG_SORT_UNKNOWN;
    return Date.UTC(year, month, day, hour, minute, 0, 0);
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return parsed;

  return DTG_SORT_UNKNOWN;
}
