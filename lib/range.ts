import {
  tzAddDays,
  tzDate,
  tzMondayOfWeek,
  tzStartOfDay,
  tzStartOfMonth,
} from "./tz";

// Date-range presets for the history/export filters. All boundaries are
// computed in the team's timezone (Europe/Kyiv), independent of what TZ the
// server runtime uses.

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

export function rangeFromPreset(preset: Preset | null): Range {
  const today = tzStartOfDay();
  switch (preset) {
    case "today":
      return { from: today, to: tzAddDays(today, 1), label: "Today" };
    case "yesterday":
      return { from: tzAddDays(today, -1), to: today, label: "Yesterday" };
    case "thisWeek":
      return { from: tzMondayOfWeek(), to: null, label: "This week" };
    case "thisMonth":
      return { from: tzStartOfMonth(), to: null, label: "This month" };
    case "lastMonth": {
      const thisMonth = tzStartOfMonth();
      return {
        from: tzStartOfMonth(tzAddDays(thisMonth, -1)),
        to: thisMonth,
        label: "Last month",
      };
    }
    case "all":
      return { from: null, to: null, label: "All time" };
    default:
      return { from: null, to: null, label: "All time" };
  }
}

// Custom from/to from URL strings — both yyyy-mm-dd, both interpreted as
// TEAM_TZ wall-clock days. `to` is normalized to the exclusive day after.
export function rangeFromDates(
  fromStr: string | null,
  toStr: string | null,
): Range {
  let from: Date | null = null;
  let to: Date | null = null;
  if (fromStr) {
    const [y, m, d] = fromStr.split("-").map(Number);
    if (y && m && d) from = tzDate(y, m, d);
  }
  if (toStr) {
    const [y, m, d] = toStr.split("-").map(Number);
    if (y && m && d) to = tzDate(y, m, d + 1); // exclusive
  }
  return {
    from,
    to,
    label: `${fromStr ?? "…"} → ${toStr ?? "now"}`,
  };
}
