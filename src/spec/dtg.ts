import type { Profile } from "../profile/types.js";

export type DtgFormat = Profile["dtg_format"];

const MONTHS_UPPER: ReadonlyArray<string> = [
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
