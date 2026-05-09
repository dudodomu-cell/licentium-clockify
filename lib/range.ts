// Date-range presets for the history/export filters.
//
// IMPORTANT: these use system-local time (`Date.setHours(0,0,0,0)` etc.).
// On Vercel set `TZ=Europe/Kyiv` (or whatever the team timezone is) so
// "today" / "this week" / "this month" boundaries match the team's wall
// clock. Locally Node uses the OS timezone, which is usually fine.

export type Preset =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "thisMonth"
  | "lastMonth"
  | "all";

export type Range = {
  from: Date | null;
  to: Date | null; // exclusive upper bound
  label: string;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function startOfThisWeek(): Date {
  const d = startOfToday();
  const day = d.getDay(); // 0 = Sun, 1 = Mon, …
  const diff = day === 0 ? 6 : day - 1; // make Monday the week start
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfThisMonth(): Date {
  const d = startOfToday();
  d.setDate(1);
  return d;
}

function startOfLastMonth(): Date {
  const d = startOfThisMonth();
  d.setMonth(d.getMonth() - 1);
  return d;
}

export function rangeFromPreset(preset: Preset | null): Range {
  switch (preset) {
    case "today": {
      const from = startOfToday();
      return { from, to: addDays(from, 1), label: "Today" };
    }
    case "yesterday": {
      const today = startOfToday();
      return { from: addDays(today, -1), to: today, label: "Yesterday" };
    }
    case "thisWeek":
      return { from: startOfThisWeek(), to: null, label: "This week" };
    case "thisMonth":
      return { from: startOfThisMonth(), to: null, label: "This month" };
    case "lastMonth":
      return {
        from: startOfLastMonth(),
        to: startOfThisMonth(),
        label: "Last month",
      };
    case "all":
      return { from: null, to: null, label: "All time" };
    default:
      return { from: null, to: null, label: "All time" };
  }
}

// Custom from/to from URL strings — both yyyy-mm-dd, both inclusive.
export function rangeFromDates(
  fromStr: string | null,
  toStr: string | null,
): Range {
  let from: Date | null = null;
  let to: Date | null = null;
  if (fromStr) {
    const [y, m, d] = fromStr.split("-").map(Number);
    from = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
    if (isNaN(from.getTime())) from = null;
  }
  if (toStr) {
    const [y, m, d] = toStr.split("-").map(Number);
    to = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
    if (!isNaN(to.getTime())) to.setDate(to.getDate() + 1); // make exclusive
    else to = null;
  }
  return {
    from,
    to,
    label: `${fromStr ?? "…"} → ${toStr ?? "now"}`,
  };
}
