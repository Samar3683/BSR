/**
 * Business time. BSR operates in Italy: the panel shows and enters every
 * moment in Europe/Rome, whatever the browser's zone, and the database
 * evaluates business days in the same zone. Instants are stored in UTC.
 */
export const BUSINESS_TIME_ZONE = "Europe/Rome";
const LOCALE = "en-GB";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function zonedParts(date: Date): ZonedParts {
  const parts: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** Offset of the business zone from UTC at an instant, in ms. */
function offsetAt(ms: number): number {
  const p = zonedParts(new Date(ms));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** Wall-clock date + time in Europe/Rome → the instant. */
export function businessToInstant(date: string, time = "00:00"): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let instant = wall - offsetAt(wall);
  const corrected = wall - offsetAt(instant);
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

/** Instant → Europe/Rome wall-clock parts for inputs. */
export function instantToBusiness(value: string | Date): { date: string; time: string } {
  const p = zonedParts(typeof value === "string" ? new Date(value) : value);
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}

/** Today's date in the business zone (YYYY-MM-DD). */
export function businessToday(now: Date = new Date()): string {
  return instantToBusiness(now).date;
}

/** Calendar arithmetic on YYYY-MM-DD strings (zone-independent). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

export function addMonths(date: string, months: number): string {
  const [y, m] = date.split("-").map(Number) as [number, number];
  const next = new Date(Date.UTC(y, m - 1 + months, 1));
  return next.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function startOfWeek(date: string): string {
  return addDays(date, -weekdayIndex(date));
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: string): string {
  return addDays(addMonths(startOfMonth(date), 1), -1);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: BUSINESS_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** 12/10/2026 14:30 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : dateTimeFormatter.format(date);
}

/** 12/10/2026 — for instants (shown in the business zone). */
export function formatInstantDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
}

/** 14:30 */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : timeFormatter.format(date);
}

/** A calendar day (YYYY-MM-DD) as 12/10/2026. */
export function formatCalendarDate(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return y && m && d ? `${d}/${m}/${y}` : date;
}

/** A calendar day as "Mon 12 Oct 2026". */
export function formatLongDate(date: string): string {
  return longDateFormatter.format(new Date(`${date}T12:00:00Z`));
}

/** "October 2026" for a day of that month. */
export function formatMonth(date: string): string {
  return monthFormatter.format(new Date(`${date.slice(0, 7)}-15T12:00:00Z`));
}

/** "3 min ago", "yesterday", or the date. */
export function formatRelative(value: string, now: Date = new Date()): string {
  const diff = (now.getTime() - new Date(value).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 172_800) return "yesterday";
  return formatDateTime(value);
}
