// Formatters shared between server and client. All time/date formatting is
// pinned to TEAM_TZ (Europe/Kyiv) via Intl.DateTimeFormat so SSR output and
// client output agree — no hydration mismatches, no UTC drift on Vercel.

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

// HH:MM:SS for the running timer (this one is duration-based, no TZ).
export function formatTimer(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

// Cached formatter instances — Intl.DateTimeFormat is comparatively
// expensive to construct, so reuse across calls.
const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TEAM_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TEAM_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toDate(input: string | Date | null | undefined): Date | null {
  if (input == null) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  return isNaN(d.getTime()) ? null : d;
}

// dd.mm.yyyy in TEAM_TZ.
export function formatDate(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return "—";
  // en-GB renders as dd/mm/yyyy; we use dots instead.
  return dateFmt.format(d).replace(/\//g, ".");
}

// dd.mm.yyyy HH:MM in TEAM_TZ.
export function formatDateTime(
  input: string | Date | null | undefined,
): string {
  const d = toDate(input);
  if (!d) return "—";
  return `${formatDate(d)} ${timeFmt.format(d)}`;
}

// HH:MM in TEAM_TZ.
export function formatTime(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return "—";
  return timeFmt.format(d);
}

// "yyyy-MM-ddTHH:mm" formatted in TEAM_TZ, suitable as a default value for
// <input type="datetime-local">. sv-SE locale gives ISO-style date format
// out of the box.
const dtLocalFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TEAM_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function toDateTimeLocal(
  input: string | Date | null | undefined,
): string {
  const d = toDate(input);
  if (!d) return "";
  const parts = dtLocalFmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// Minutes between two ISO timestamps (TZ-neutral — just arithmetic).
export function durationMinutes(
  startsAt: string,
  endsAt: string | null,
): number {
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : Date.now();
  return Math.max(0, (end - start) / 60000);
}
