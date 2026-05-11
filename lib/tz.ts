// Wall-clock time math, parameterized by timezone.
//
// Two roles for a timezone in this app:
//   1. TEAM_TZ — the company's "default" TZ, used as fallback when we don't
//      know better, and for billing-related fixed periods.
//   2. viewer TZ — the timezone the current user actually sits in, detected
//      from their browser via a cookie (see lib/viewer-tz.ts +
//      components/viewer-tz-writer.tsx). This drives display + their personal
//      "today / this week / this month" boundaries.
//
// All helpers here accept an optional `tz` argument that defaults to
// TEAM_TZ, so unupdated call sites keep working.

export const TEAM_TZ = "Europe/Kyiv";

// Offset of `tz` from UTC at the instant `date`, in minutes.
export function tzOffsetMinutes(date: Date, tz: string = TEAM_TZ): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const off = parts.find((p) => p.type === "timeZoneName")?.value;
  if (!off || off === "GMT") return 0;
  const m = off.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "+" ? 1 : -1;
  return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
}

// Wall-clock {year, month (1-12), day} that `at` falls on in `tz`.
export function tzYmd(
  at: Date = new Date(),
  tz: string = TEAM_TZ,
): { year: number; month: number; day: number } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(at)
    .split("-")
    .map(Number);
  return { year: y, month: m, day: d };
}

// Build a UTC Date from `tz` wall-clock components.
// tzDate(2026, 5, 11, 17, 55, "Europe/Kyiv") returns the UTC instant of
// "17:55 May 11 Kyiv".
export function tzDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  tz: string = TEAM_TZ,
): Date {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMin = tzOffsetMinutes(new Date(naiveUtcMs), tz);
  return new Date(naiveUtcMs - offsetMin * 60 * 1000);
}

// Convert "YYYY-MM-DDTHH:MM" (datetime-local input value) — interpreted as
// `tz` wall-clock — to a UTC ISO string.
export function localToUtcIso(local: string, tz: string = TEAM_TZ): string {
  if (!local) return "";
  const [date, time] = local.split("T");
  if (!date) return "";
  const [y, mo, d] = date.split("-").map(Number);
  if (!y || !mo || !d) return "";
  const [h, mi] = (time ?? "00:00").split(":").map(Number);
  return tzDate(y, mo, d, h || 0, mi || 0, tz).toISOString();
}

// Start of `at`'s day (00:00 wall-clock in `tz`), as a UTC Date.
export function tzStartOfDay(
  at: Date = new Date(),
  tz: string = TEAM_TZ,
): Date {
  const { year, month, day } = tzYmd(at, tz);
  return tzDate(year, month, day, 0, 0, tz);
}

// Add `n` days to `d` in `tz` wall-clock. Returns 00:00 of the resulting day.
export function tzAddDays(
  d: Date,
  n: number,
  tz: string = TEAM_TZ,
): Date {
  const { year, month, day } = tzYmd(d, tz);
  return tzDate(year, month, day + n, 0, 0, tz);
}

// Start of the month containing `at`, in `tz`.
export function tzStartOfMonth(
  at: Date = new Date(),
  tz: string = TEAM_TZ,
): Date {
  const { year, month } = tzYmd(at, tz);
  return tzDate(year, month, 1, 0, 0, tz);
}

// Monday of the week containing `at`, in `tz`.
export function tzMondayOfWeek(
  at: Date = new Date(),
  tz: string = TEAM_TZ,
): Date {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(at);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = map[weekday] ?? 0;
  return tzAddDays(at, -offset, tz);
}

// Convenience: do two ISO timestamps fall on the same calendar day in `tz`?
// Used for the "+1d" cross-midnight indicator.
export function sameTzDay(
  a: string | Date,
  b: string | Date,
  tz: string = TEAM_TZ,
): boolean {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  const ya = tzYmd(da, tz);
  const yb = tzYmd(db, tz);
  return ya.year === yb.year && ya.month === yb.month && ya.day === yb.day;
}

// How many full local days separate `start` from `end` in `tz`?
// Returns 0 if same day, 1 if next day, etc.
export function tzDayDelta(
  start: string | Date,
  end: string | Date,
  tz: string = TEAM_TZ,
): number {
  const ds = typeof start === "string" ? new Date(start) : start;
  const de = typeof end === "string" ? new Date(end) : end;
  const startKey = tzYmd(ds, tz);
  const endKey = tzYmd(de, tz);
  const startMs = Date.UTC(startKey.year, startKey.month - 1, startKey.day);
  const endMs = Date.UTC(endKey.year, endKey.month - 1, endKey.day);
  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000));
}
