// All wall-clock time math is pinned to the team's timezone, regardless of
// what TZ env var Node.js uses. This keeps "17:55 May 11" written in a
// browser form mean "17:55 Kyiv on May 11" no matter where the server runs.
//
// Approach: use Intl.DateTimeFormat with `timeZone: TEAM_TZ` to query both
// the wall-clock components of an instant in that zone, and the UTC offset
// at that instant — handles DST automatically.

export const TEAM_TZ = "Europe/Kyiv";

// Offset of TEAM_TZ from UTC at `date`, in minutes.
// E.g. Kyiv summer (EEST) = 180, winter (EET) = 120.
export function teamTzOffsetMinutes(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TEAM_TZ,
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

// Wall-clock {year, month (1-12), day} that `at` falls on in TEAM_TZ.
export function tzYmd(at: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEAM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(at)
    .split("-")
    .map(Number);
  return { year: y, month: m, day: d };
}

// Build a UTC Date from TEAM_TZ wall-clock components.
// `tzDate(2026, 5, 11, 17, 55)` returns the UTC instant of "17:55 May 11 Kyiv".
export function tzDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMin = teamTzOffsetMinutes(new Date(naiveUtcMs));
  return new Date(naiveUtcMs - offsetMin * 60 * 1000);
}

// Convert "YYYY-MM-DDTHH:MM" (datetime-local input value) — interpreted as
// TEAM_TZ wall-clock — to a UTC ISO string. Empty input returns "".
export function localToUtcIso(local: string): string {
  if (!local) return "";
  const [date, time] = local.split("T");
  if (!date) return "";
  const [y, mo, d] = date.split("-").map(Number);
  if (!y || !mo || !d) return "";
  const [h, mi] = (time ?? "00:00").split(":").map(Number);
  return tzDate(y, mo, d, h || 0, mi || 0).toISOString();
}

// Start of `at`'s day (00:00 wall-clock in TEAM_TZ), as a UTC Date.
export function tzStartOfDay(at: Date = new Date()): Date {
  const { year, month, day } = tzYmd(at);
  return tzDate(year, month, day);
}

// Add `n` days to `d` in TEAM_TZ wall-clock terms. Returns 00:00 of the
// resulting day (UTC instant for that Kyiv midnight).
export function tzAddDays(d: Date, n: number): Date {
  const { year, month, day } = tzYmd(d);
  return tzDate(year, month, day + n);
}

// Start of the month containing `at`, in TEAM_TZ.
export function tzStartOfMonth(at: Date = new Date()): Date {
  const { year, month } = tzYmd(at);
  return tzDate(year, month, 1);
}

// Monday of the week containing `at`, in TEAM_TZ.
export function tzMondayOfWeek(at: Date = new Date()): Date {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TEAM_TZ,
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
  return tzAddDays(at, -offset);
}
