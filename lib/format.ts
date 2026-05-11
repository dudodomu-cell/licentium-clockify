// Formatters shared between server and client. All TZ-sensitive formatters
// accept an optional `tz` argument (default TEAM_TZ). Pages thread the
// viewer's TZ in; client components read it via useViewerTz() and pass it.

import { TEAM_TZ } from "./tz";

export function formatMoney(n: number): string {
  if (!isFinite(n)) return "$0";
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

export function formatNum(n: number, decimals = 2): string {
  if (!isFinite(n)) return "0";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatHours(minutes: number): string {
  if (minutes < 0) minutes = 0;
  return formatNum(minutes / 60);
}

// Human-friendly duration: "01 h 30 m".
export function formatDuration(minutes: number): string {
  if (minutes < 0) minutes = 0;
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")} h ${String(m).padStart(2, "0")} m`;
}

// HH:MM:SS for the running timer (duration-based, TZ-independent).
export function formatTimer(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

// Construct-on-demand formatters — the `tz` is determined at runtime so we
// can't pre-cache one global instance per locale.
function dateFmt(tz: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function timeFmt(tz: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function dtLocalFmt(tz: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toDate(input: string | Date | null | undefined): Date | null {
  if (input == null) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  return isNaN(d.getTime()) ? null : d;
}

// dd.mm.yyyy in `tz` (default TEAM_TZ).
export function formatDate(
  input: string | Date | null | undefined,
  tz: string = TEAM_TZ,
): string {
  const d = toDate(input);
  if (!d) return "—";
  // en-GB renders dd/mm/yyyy; we use dots instead.
  return dateFmt(tz).format(d).replace(/\//g, ".");
}

// dd.mm.yyyy HH:MM in `tz`.
export function formatDateTime(
  input: string | Date | null | undefined,
  tz: string = TEAM_TZ,
): string {
  const d = toDate(input);
  if (!d) return "—";
  return `${formatDate(d, tz)} ${timeFmt(tz).format(d)}`;
}

// HH:MM in `tz`.
export function formatTime(
  input: string | Date | null | undefined,
  tz: string = TEAM_TZ,
): string {
  const d = toDate(input);
  if (!d) return "—";
  return timeFmt(tz).format(d);
}

// "yyyy-MM-ddTHH:mm" formatted in `tz`, for <input type="datetime-local">.
// sv-SE locale gives ISO-style date format out of the box.
export function toDateTimeLocal(
  input: string | Date | null | undefined,
  tz: string = TEAM_TZ,
): string {
  const d = toDate(input);
  if (!d) return "";
  const parts = dtLocalFmt(tz).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// Minutes between two ISO timestamps (TZ-neutral arithmetic).
export function durationMinutes(
  startsAt: string,
  endsAt: string | null,
): number {
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : Date.now();
  return Math.max(0, (end - start) / 60000);
}
