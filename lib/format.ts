// Formatters shared between server and client. Pure functions, no React.

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

// HH:MM:SS for the running timer.
export function formatTimer(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

// dd.mm.yyyy from any ISO/parsable date.
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join(".");
}

// dd.mm.yyyy HH:MM (local time).
export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return (
    formatDate(d) +
    " " +
    [
      String(d.getHours()).padStart(2, "0"),
      String(d.getMinutes()).padStart(2, "0"),
    ].join(":")
  );
}

// HH:MM (local time only).
export function formatTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
  ].join(":");
}

// "yyyy-MM-ddTHH:mm" — value format expected by <input type="datetime-local">.
export function toDateTimeLocal(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "";
  return [
    d.getFullYear(),
    "-",
    String(d.getMonth() + 1).padStart(2, "0"),
    "-",
    String(d.getDate()).padStart(2, "0"),
    "T",
    String(d.getHours()).padStart(2, "0"),
    ":",
    String(d.getMinutes()).padStart(2, "0"),
  ].join("");
}

// Minutes between two ISO timestamps.
export function durationMinutes(startsAt: string, endsAt: string | null): number {
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : Date.now();
  return Math.max(0, (end - start) / 60000);
}
