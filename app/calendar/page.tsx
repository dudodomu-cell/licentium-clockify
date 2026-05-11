import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { fetchEntries, fetchProfiles } from "@/lib/db";
import { durationMinutes, formatDuration } from "@/lib/format";
import { tzAddDays, tzDate, tzMondayOfWeek, tzYmd } from "@/lib/tz";
import { getViewerTz } from "@/lib/viewer-tz";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string; user?: string }>;

function isoDateTz(d: Date, tz: string): string {
  const { year, month, day } = tzYmd(d, tz);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isoMonthTz(d: Date, tz: string): string {
  const { year, month } = tzYmd(d, tz);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseMonth(
  monthStr: string | undefined,
  tz: string,
): { year: number; month: number } {
  if (monthStr) {
    const [y, m] = monthStr.split("-").map(Number);
    if (y && m >= 1 && m <= 12) return { year: y, month: m };
  }
  const ymd = tzYmd(new Date(), tz);
  return { year: ymd.year, month: ymd.month };
}

const WEEK_HEADER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const profile = await getCurrentProfile();
  const viewerTz = await getViewerTz();

  const { year, month } = parseMonth(sp.month, viewerTz);
  const monthStart = tzDate(year, month, 1, 0, 0, viewerTz);

  const userIdFilter = profile.is_admin ? sp.user || undefined : profile.id;

  // Grid starts on Monday on/before day 1 of the month, in viewer TZ.
  const gridStart = tzMondayOfWeek(monthStart, viewerTz);
  const fetchEndDate = tzAddDays(gridStart, 42, viewerTz);

  const [profiles, entries] = await Promise.all([
    profile.is_admin ? fetchProfiles() : Promise.resolve([profile]),
    fetchEntries({
      since: gridStart.toISOString(),
      until: fetchEndDate.toISOString(),
      userId: userIdFilter,
    }),
  ]);

  // Aggregate per viewer-TZ day.
  const perDay = new Map<string, { minutes: number; entries: number }>();
  for (const e of entries) {
    if (e.ends_at === null) continue;
    const key = isoDateTz(new Date(e.starts_at), viewerTz);
    const m = durationMinutes(e.starts_at, e.ends_at);
    const prev = perDay.get(key) ?? { minutes: 0, entries: 0 };
    perDay.set(key, {
      minutes: prev.minutes + m,
      entries: prev.entries + 1,
    });
  }

  // 6 weeks × 7 days grid.
  let cells: {
    date: Date;
    day: number;
    inMonth: boolean;
    minutes: number;
    entries: number;
  }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = tzAddDays(gridStart, i, viewerTz);
    const ymd = tzYmd(d, viewerTz);
    const key = isoDateTz(d, viewerTz);
    const agg = perDay.get(key) ?? { minutes: 0, entries: 0 };
    cells.push({
      date: d,
      day: ymd.day,
      inMonth: ymd.year === year && ymd.month === month,
      minutes: agg.minutes,
      entries: agg.entries,
    });
  }
  // Trim trailing weeks that are entirely outside the month and empty.
  while (
    cells.length > 28 &&
    cells.slice(-7).every((c) => !c.inMonth && c.minutes === 0)
  ) {
    cells = cells.slice(0, -7);
  }

  const todayIso = isoDateTz(new Date(), viewerTz);

  const userParam = userIdFilter ? `&user=${userIdFilter}` : "";
  const prevMonth = `/calendar?month=${isoMonthTz(tzDate(year, month - 1, 1, 0, 0, viewerTz), viewerTz)}${userParam}`;
  const nextMonth = `/calendar?month=${isoMonthTz(tzDate(year, month + 1, 1, 0, 0, viewerTz), viewerTz)}${userParam}`;
  const todayLink = `/calendar${userIdFilter ? `?user=${userIdFilter}` : ""}`;

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: viewerTz,
    year: "numeric",
    month: "long",
  }).format(monthStart);

  const dayLink = (date: Date) => {
    const day = isoDateTz(date, viewerTz);
    const params = new URLSearchParams({ from: day, to: day });
    if (userIdFilter) params.set("user", userIdFilter);
    return `/history?${params.toString()}`;
  };

  const monthTotalMinutes = cells
    .filter((c) => c.inMonth)
    .reduce((s, c) => s + c.minutes, 0);
  const monthTotalEntries = cells
    .filter((c) => c.inMonth)
    .reduce((s, c) => s + c.entries, 0);

  return (
    <main>
      <div className="hero">
        <h1>Calendar</h1>
        <p>
          Monthly view of total hours per day. Click any day to open History
          scoped to that day.
        </p>
      </div>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>01 /</b> {monthLabel}
          </div>
          <div className="section-actions">
            <Link href={prevMonth} className="btn">
              ← Prev
            </Link>
            <Link href={todayLink} className="btn">
              Today
            </Link>
            <Link href={nextMonth} className="btn">
              Next →
            </Link>
          </div>
        </div>

        <div className="section-num mute" style={{ marginBottom: 16 }}>
          {formatDuration(monthTotalMinutes)} · {monthTotalEntries} entr
          {monthTotalEntries === 1 ? "y" : "ies"} this month
        </div>

        {profile.is_admin && (
          <form method="get" action="/calendar" className="filters">
            <input
              type="hidden"
              name="month"
              value={`${year}-${String(month).padStart(2, "0")}`}
            />
            <label className="field">
              User
              <select
                className="select sm"
                name="user"
                defaultValue={sp.user ?? ""}
              >
                <option value="">Everyone</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn primary">
              Apply
            </button>
            <Link
              href={`/calendar?month=${year}-${String(month).padStart(2, "0")}`}
              className="btn"
            >
              Reset
            </Link>
          </form>
        )}

        <div className="calendar-grid">
          {WEEK_HEADER.map((d) => (
            <div key={d} className="calendar-header">
              {d}
            </div>
          ))}
          {cells.map((c, i) => {
            const classes = [
              "calendar-cell",
              c.inMonth ? "" : "outside",
              isoDateTz(c.date, viewerTz) === todayIso ? "today" : "",
              c.minutes > 0 ? "has-data" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <Link key={i} href={dayLink(c.date)} className={classes}>
                <div className="calendar-day-num">{c.day}</div>
                {c.minutes > 0 && (
                  <>
                    <div className="calendar-day-total">
                      {formatDuration(c.minutes)}
                    </div>
                    <div className="calendar-day-count">
                      {c.entries} entr{c.entries === 1 ? "y" : "ies"}
                    </div>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
