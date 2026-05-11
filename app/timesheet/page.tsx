import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { fetchEntries, fetchProfiles, fetchProjects } from "@/lib/db";
import { durationMinutes, formatDate, formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ week?: string; user?: string }>;

function isoDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d;
}

function parseWeek(weekStr: string | undefined): Date {
  if (weekStr) {
    const [y, m, d] = weekStr.split("-").map(Number);
    if (y && m && d) {
      const dt = new Date(y, m - 1, d);
      if (!isNaN(dt.getTime())) return mondayOf(dt);
    }
  }
  return mondayOf(new Date());
}

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const profile = await getCurrentProfile();

  const weekStart = parseWeek(sp.week);
  const weekEnd = addDays(weekStart, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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

  // Project rows × 7 day columns matrix.
  type Row = {
    key: string;
    project: string;
    color: string;
    minutes: number[];
    total: number;
  };
  const matrix = new Map<string, Row>();
  for (const e of entries) {
    if (e.ends_at === null) continue;
    const dayIdx = Math.floor(
      (new Date(e.starts_at).getTime() - weekStart.getTime()) /
        (24 * 60 * 60 * 1000),
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
  const prev = `/timesheet?week=${isoDate(addDays(weekStart, -7))}${userParam}`;
  const next = `/timesheet?week=${isoDate(addDays(weekStart, 7))}${userParam}`;
  const today = `/timesheet${userIdFilter ? `?user=${userIdFilter}` : ""}`;

  // Use the same project list for filter URLs; archived projects keep their
  // entries even though they're hidden from the timer dropdown.
  const cellLink = (dayIdx: number, projectKey: string) => {
    const day = isoDate(days[dayIdx]);
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
            <b>01 /</b> Week of {formatDate(weekStart)}
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
          {formatDate(weekStart)} → {formatDate(addDays(weekStart, 6))}
        </div>

        {profile.is_admin && (
          <form method="get" action="/timesheet" className="filters">
            <input type="hidden" name="week" value={isoDate(weekStart)} />
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
              href={`/timesheet?week=${isoDate(weekStart)}`}
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
              {days.map((d, i) => (
                <div key={i} className="num">
                  {DAY_LABELS[i]}
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--text-dim)",
                      marginTop: 2,
                    }}
                  >
                    {String(d.getDate()).padStart(2, "0")}.
                    {String(d.getMonth() + 1).padStart(2, "0")}
                  </div>
                </div>
              ))}
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
