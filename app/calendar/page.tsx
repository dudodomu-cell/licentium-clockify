import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { fetchEntries, fetchProfiles } from "@/lib/db";
import { durationMinutes, formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string; user?: string }>;

function isoDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function isoMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(monthStr: string | undefined): { year: number; month: number } {
  if (monthStr) {
    const [y, m] = monthStr.split("-").map(Number);
    if (y && m >= 1 && m <= 12) return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

const WEEK_HEADER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const profile = await getCurrentProfile();

  const { year, month } = parseMonth(sp.month);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1); // exclusive

  // Members pinned to themselves; admins can filter.
  const userIdFilter = profile.is_admin ? sp.user || undefined : profile.id;

  // Determine the grid start (Monday on/before day 1 of month).
  const dow = monthStart.getDay(); // 0=Sun, 1=Mon
  const offset = dow === 0 ? -6 : 1 - dow;
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() + offset);

  // Fetch entries from gridStart to ~6 weeks later (to cover all visible cells).
  const fetchStart = new Date(gridStart);
  const fetchEnd = new Date(gridStart);
  fetchEnd.setDate(fetchEnd.getDate() + 42);

  const [profiles, entries] = await Promise.all([
    profile.is_admin ? fetchProfiles() : Promise.resolve([profile]),
    fetchEntries({
      since: fetchStart.toISOString(),
      until: fetchEnd.toISOString(),
      userId: userIdFilter,
    }),
  ]);

  // Aggregate per-day.
  const perDay = new Map<string, { minutes: number; entries: number }>();
  for (const e of entries) {
    if (e.ends_at === null) continue;
    const key = isoDate(new Date(e.starts_at));
    const m = durationMinutes(e.starts_at, e.ends_at);
    const prev = perDay.get(key) ?? { minutes: 0, entries: 0 };
    perDay.set(key, {
      minutes: prev.minutes + m,
      entries: prev.entries + 1,
    });
  }

  // Build 6 weeks × 7 days grid.
  let cells: {
    date: Date;
    inMonth: boolean;
    minutes: number;
    entries: number;
  }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    const key = isoDate(d);
    const agg = perDay.get(key) ?? { minutes: 0, entries: 0 };
    cells.push({
      date: d,
      inMonth: d.getMonth() === month - 1,
      minutes: agg.minutes,
      entries: agg.entries,
    });
  }
  // Trim trailing weeks that are entirely outside the month and have no data.
  while (
    cells.length > 28 &&
    cells.slice(-7).every((c) => !c.inMonth && c.minutes === 0)
  ) {
    cells = cells.slice(0, -7);
  }

  const todayIso = isoDate(new Date());

  const userParam = userIdFilter ? `&user=${userIdFilter}` : "";
  const prevMonth = `/calendar?month=${isoMonth(new Date(year, month - 2, 1))}${userParam}`;
  const nextMonth = `/calendar?month=${isoMonth(new Date(year, month, 1))}${userParam}`;
  const todayLink = `/calendar${userIdFilter ? `?user=${userIdFilter}` : ""}`;

  const monthLabel = monthStart.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  const dayLink = (date: Date) => {
    const day = isoDate(date);
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
              isoDate(c.date) === todayIso ? "today" : "",
              c.minutes > 0 ? "has-data" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <Link key={i} href={dayLink(c.date)} className={classes}>
                <div className="calendar-day-num">{c.date.getDate()}</div>
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
