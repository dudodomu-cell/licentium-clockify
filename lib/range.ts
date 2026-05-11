import {
  TEAM_TZ,
  tzAddDays,
  tzDate,
  tzMondayOfWeek,
  tzStartOfDay,
  tzStartOfMonth,
} from "./tz";

// Date-range presets. All boundaries computed in the supplied `tz`
// (defaults to TEAM_TZ). Pages typically pass the viewer's TZ so that
// "today" means "the viewer's today".

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

export function rangeFromPreset(
  preset: Preset | null,
  tz: string = TEAM_TZ,
): Range {
  const today = tzStartOfDay(new Date(), tz);
  switch (preset) {
    case "today":
      return { from: today, to: tzAddDays(today, 1, tz), label: "Today" };
    case "yesterday":
      return { from: tzAddDays(today, -1, tz), to: today, label: "Yesterday" };
    case "thisWeek":
      return { from: tzMondayOfWeek(new Date(), tz), to: null, label: "This week" };
    case "thisMonth":
      return { from: tzStartOfMonth(new Date(), tz), to: null, label: "This month" };
    case "lastMonth": {
      const thisMonth = tzStartOfMonth(new Date(), tz);
      return {
        from: tzStartOfMonth(tzAddDays(thisMonth, -1, tz), tz),
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

// Custom from/to from URL strings — both yyyy-mm-dd, interpreted as `tz`
// wall-clock days. `to` is normalized to the exclusive day after.
export function rangeFromDates(
  fromStr: string | null,
  toStr: string | null,
  tz: string = TEAM_TZ,
): Range {
  let from: Date | null = null;
  let to: Date | null = null;
  if (fromStr) {
    const [y, m, d] = fromStr.split("-").map(Number);
    if (y && m && d) from = tzDate(y, m, d, 0, 0, tz);
  }
  if (toStr) {
    const [y, m, d] = toStr.split("-").map(Number);
    if (y && m && d) to = tzDate(y, m, d + 1, 0, 0, tz); // exclusive
  }
  return {
    from,
    to,
    label: `${fromStr ?? "…"} → ${toStr ?? "now"}`,
  };
}
