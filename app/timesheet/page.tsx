import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { fetchEntries, fetchProfiles, fetchProjects } from "@/lib/db";
import { durationMinutes, formatDate, formatDuration } from "@/lib/format";
import { tzAddDays, tzDate, tzMondayOfWeek, tzYmd } from "@/lib/tz";
import { getViewerTz } from "@/lib/viewer-tz";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ week?: string; user?: string }>;

function isoDateTz(d: Date, tz: string): string {
  const { year, month, day } = tzYmd(d, tz);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseWeek(weekStr: string | undefined, tz: string): Date {
  if (weekStr) {
    const [y, m, d] = weekStr.split("-").map(Number);
    if (y && m && d) return tzMondayOfWeek(tzDate(y, m, d, 0, 0, tz), tz);
  }
  return tzMondayOfWeek(new Date(), tz);
}

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const profile = await getCurrentProfile();
  const viewerTz = await getViewerTz();

  const weekStart = parseWeek(sp.week, viewerTz);
  const weekEnd = tzAddDays(weekStart, 7, viewerTz);
  const days = Array.from({ length: 7 }, (_, i) => tzAddDays(weekStart, i, viewerTz));

  // Members are pinned to themselves regardless of URL.
  const userIdFilter = profile.is_admin ? sp.user || undefined : profile.id;

  const [projects, profiles, entries] = await Promise.all([
    fetchProjects({ includeArchived: true }),
    profile.is_admin ? fetchProfiles() : Promise.resolve([profile]),
    fetchEntries({
      since: weekStart.toISOString(),
      until: weekEnd.toISOString(),
      userId: userIdFilter,
    }),
  ]);

  // Project rows × 7 day columns matrix. We use millisecond delta from the
  // week's Monday to decide which day column an entry falls into — this is
  // TZ-neutral because both timestamps are UTC instants and we already
  // anchored weekStart at Kyiv midnight.
  type Row = {
    key: string;
    project: string;
    color: string;
    minutes: number[];
    total: number;
  };
  const matrix = new Map<string, Row>();
  const weekStartMs = weekStart.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  for (const e of entries) {
    if (e.ends_at === null) continue;
    const dayIdx = Math.floor(
      (new Date(e.starts_at).getTime() - weekStartMs) / dayMs,
    );
    if (dayIdx < 0 || dayIdx > 6) continue;
    const m = durationMinutes(e.starts_at, e.ends_at);
    const key = e.project_id ?? "__none__";
    const prev =
      matrix.get(key) ??
      {
        key,
        project: e.project_name ?? "(no project)",
        color: e.project_color ?? "#666",
        minutes: [0, 0, 0, 0, 0, 0, 0],
        total: 0,
      };
    prev.minutes[dayIdx] += m;
    prev.total += m;
    matrix.set(key, prev);
  }

  const rows = [...matrix.values()].sort((a, b) => b.total - a.total);
  const colTotals = days.map((_, i) =>
    rows.reduce((s, r) => s + r.minutes[i], 0),
  );
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  const userParam = userIdFilter ? `&user=${userIdFilter}` : "";
  const prev = `/timesheet?week=${isoDateTz(tzAddDays(weekStart, -7, viewerTz), viewerTz)}${userParam}`;
  const next = `/timesheet?week=${isoDateTz(tzAddDays(weekStart, 7, viewerTz), viewerTz)}${userParam}`;
  const today = `/timesheet${userIdFilter ? `?user=${userIdFilter}` : ""}`;

  const cellLink = (dayIdx: number, projectKey: string) => {
    const day = isoDateTz(days[dayIdx], viewerTz);
    const params = new URLSearchParams({ from: day, to: day });
    if (userIdFilter) params.set("user", userIdFilter);
    if (projectKey !== "__none__") params.set("project", projectKey);
    return `/history?${params.toString()}`;
  };

  const colTemplate = "1.6fr repeat(7, 1fr) 1fr";

  return (
    <main>
      <div className="hero">
        <h1>Timesheet</h1>
        <p>
          Hours per project per day for the week. Click any cell to drop into
          History scoped to that day and project.
        </p>
      </div>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>01 /</b> Week of {formatDate(weekStart, viewerTz)}
          </div>
          <div className="section-actions">
            <Link href={prev} className="btn">
              ← Prev
            </Link>
            <Link href={today} className="btn">
              Today
            </Link>
            <Link href={next} className="btn">
              Next →
            </Link>
          </div>
        </div>

        <div className="section-num mute" style={{ marginBottom: 16 }}>
          {formatDate(weekStart, viewerTz)} → {formatDate(tzAddDays(weekStart, 6, viewerTz), viewerTz)}
        </div>

        {profile.is_admin && (
          <form method="get" action="/timesheet" className="filters">
            <input type="hidden" name="week" value={isoDateTz(weekStart, viewerTz)} />
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
              href={`/timesheet?week=${isoDateTz(weekStart, viewerTz)}`}
              className="btn"
            >
              Reset
            </Link>
          </form>
        )}

        <div style={{ overflowX: "auto" }}>
          <div className="ledger" style={{ minWidth: 720 }}>
            <div
              className="ledger-row head"
              style={{ gridTemplateColumns: colTemplate }}
            >
              <div>Project</div>
              {days.map((d, i) => {
                const ymd = tzYmd(d, viewerTz);
                return (
                  <div key={i} className="num">
                    {DAY_LABELS[i]}
                    <div
                      style={{
                        fontSize: 9,
                        color: "var(--text-dim)",
                        marginTop: 2,
                      }}
                    >
                      {String(ymd.day).padStart(2, "0")}.
                      {String(ymd.month).padStart(2, "0")}
                    </div>
                  </div>
                );
              })}
              <div className="num">Total</div>
            </div>

            {rows.length === 0 ? (
              <div
                className="ledger-row"
                style={{
                  gridTemplateColumns: "1fr",
                  textAlign: "center",
                  padding: "32px 0",
                  color: "var(--text-mute)",
                }}
              >
                No entries this week.
              </div>
            ) : (
              <>
                {rows.map((r) => (
                  <div
                    key={r.key}
                    className="ledger-row"
                    style={{ gridTemplateColumns: colTemplate }}
                  >
                    <div className="label-cell">
                      <span className="pill solid">
                        <span
                          className="dot"
                          style={{ background: r.color }}
                        />
                        {r.project}
                      </span>
                    </div>
                    {r.minutes.map((m, i) => (
                      <div key={i} className="num">
                        {m > 0 ? (
                          <Link
                            href={cellLink(i, r.key)}
                            className="cell-link"
                          >
                            {formatDuration(m)}
                          </Link>
                        ) : (
                          <span className="dim">—</span>
                        )}
                      </div>
                    ))}
                    <div className="num">{formatDuration(r.total)}</div>
                  </div>
                ))}
                <div
                  className="ledger-row foot"
                  style={{ gridTemplateColumns: colTemplate }}
                >
                  <div>Total</div>
                  {colTotals.map((m, i) => (
                    <div key={i} className="num">
                      {m > 0 ? (
                        formatDuration(m)
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </div>
                  ))}
                  <div className="num">{formatDuration(grandTotal)}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
