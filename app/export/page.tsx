import { getCurrentProfile } from "@/lib/auth";
import { fetchEntries, fetchProfiles, fetchProjects } from "@/lib/db";
import {
  rangeFromDates,
  rangeFromPreset,
  type Preset,
} from "@/lib/range";
import { EntriesGrouped } from "@/components/entries-grouped";
import { FilterBar } from "@/components/filter-bar";
import { PrintButton } from "@/components/print-button";
import { WeekStats } from "@/components/week-stats";
import {
  durationMinutes,
  formatDate,
  formatHours,
  formatMoney,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  user?: string;
  project?: string;
  from?: string;
  to?: string;
  preset?: string;
}>;

const PRESETS = new Set<Preset>([
  "today",
  "yesterday",
  "thisWeek",
  "thisMonth",
  "lastMonth",
  "all",
]);

export default async function ExportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  await getCurrentProfile(); // gate

  let range;
  const preset = (sp.preset ?? "") as Preset;
  if (sp.from || sp.to) {
    range = rangeFromDates(sp.from ?? null, sp.to ?? null);
  } else if (PRESETS.has(preset)) {
    range = rangeFromPreset(preset);
  } else {
    range = rangeFromPreset("thisMonth");
  }

  const [profiles, projects, entries] = await Promise.all([
    fetchProfiles(),
    fetchProjects({ includeArchived: true }),
    fetchEntries({
      since: range.from?.toISOString(),
      until: range.to?.toISOString(),
      userId: sp.user || undefined,
      projectId: sp.project || undefined,
    }),
  ]);

  // Per-project breakdown for the printable summary.
  type Bucket = { name: string; color: string; minutes: number; earned: number };
  const projectBuckets = new Map<string, Bucket>();
  let totalMinutes = 0;
  let totalEarned = 0;
  for (const e of entries) {
    const m = durationMinutes(e.starts_at, e.ends_at);
    const earned = (m / 60) * Number(e.rate);
    totalMinutes += m;
    totalEarned += earned;
    const key = e.project_id ?? "__none__";
    const prev =
      projectBuckets.get(key) ?? {
        name: e.project_name ?? "(no project)",
        color: e.project_color ?? "#444",
        minutes: 0,
        earned: 0,
      };
    projectBuckets.set(key, {
      ...prev,
      minutes: prev.minutes + m,
      earned: prev.earned + earned,
    });
  }
  const projectRows = [...projectBuckets.values()].sort(
    (a, b) => b.minutes - a.minutes,
  );

  const csvParams = new URLSearchParams();
  if (sp.user) csvParams.set("user", sp.user);
  if (sp.project) csvParams.set("project", sp.project);
  if (sp.from) csvParams.set("from", sp.from);
  if (sp.to) csvParams.set("to", sp.to);
  if (sp.preset) csvParams.set("preset", sp.preset);
  const csvHref = `/api/export/csv${csvParams.toString() ? `?${csvParams.toString()}` : ""}`;

  const filteredUser = sp.user
    ? profiles.find((p) => p.id === sp.user)?.full_name
    : null;
  const filteredProject = sp.project
    ? projects.find((p) => p.id === sp.project)?.name
    : null;

  const periodFromLabel = range.from ? formatDate(range.from) : "—";
  const periodToLabel = range.to
    ? formatDate(new Date(range.to.getTime() - 1))
    : formatDate(new Date());

  return (
    <main>
      <div className="hero no-print">
        <h1>Export</h1>
        <p>
          Pick a period (and optionally a user or project), then either{" "}
          <b>Print → Save as PDF</b> or download the CSV. Drop the CSV into
          Claude with &ldquo;make me an invoice&rdquo; and you&rsquo;re done.
        </p>
      </div>

      <section className="no-print">
        <div className="section-head">
          <div className="section-num">
            <b>01 /</b> Filters
          </div>
          <div className="section-num mute">{range.label}</div>
        </div>
        <FilterBar
          profiles={profiles}
          projects={projects}
          current={{
            user: sp.user,
            project: sp.project,
            from: sp.from,
            to: sp.to,
            preset:
              sp.from || sp.to ? undefined : preset || "thisMonth",
          }}
          basePath="/export"
        />
        <div className="filters">
          <a className="btn" href={csvHref} download>
            Download CSV
          </a>
          <PrintButton />
        </div>
      </section>

      {/* Printable header */}
      <div style={{ marginBottom: 24 }}>
        <div className="brand">
          § <b>Licentium</b> Clockify · Time report
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 600,
            marginTop: 8,
            letterSpacing: "-0.02em",
          }}
        >
          {periodFromLabel} → {periodToLabel}
        </h1>
        <p className="mute" style={{ marginTop: 6 }}>
          {filteredUser ? `User: ${filteredUser}` : "All users"}
          {" · "}
          {filteredProject ? `Project: ${filteredProject}` : "All projects"}
        </p>
      </div>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>02 /</b> Totals
          </div>
        </div>
        <div className="grid">
          <div className="card">
            <div className="card-label">Total hours</div>
            <div>
              <div className="card-value">{formatHours(totalMinutes)}h</div>
              <div className="card-sub">
                {entries.length} entr{entries.length === 1 ? "y" : "ies"}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-label">Total amount</div>
            <div>
              <div className="card-value">{formatMoney(totalEarned)}</div>
              <div className="card-sub">at the rates entered per row</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>03 /</b> Per person
          </div>
        </div>
        <WeekStats entries={entries} profiles={profiles} />
      </section>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>04 /</b> Per project
          </div>
        </div>
        {projectRows.length === 0 ? (
          <div className="form mute" style={{ textAlign: "center" }}>
            No entries in this period.
          </div>
        ) : (
          <div className="ledger">
            <div className="ledger-row head projects-grid">
              <div>Project</div>
              <div>Share</div>
              <div className="num">Hours</div>
              <div className="num">Amount</div>
              <div></div>
            </div>
            {projectRows.map((r) => {
              const share =
                totalMinutes > 0 ? (r.minutes / totalMinutes) * 100 : 0;
              return (
                <div key={r.name} className="ledger-row projects-grid">
                  <div className="label-cell">
                    <span className="pill solid">
                      <span
                        className="dot"
                        style={{ background: r.color }}
                      />
                      {r.name}
                    </span>
                  </div>
                  <div className="num mute">{share.toFixed(1)}%</div>
                  <div className="num">{formatHours(r.minutes)}h</div>
                  <div className="num">{formatMoney(r.earned)}</div>
                  <div></div>
                </div>
              );
            })}
            <div className="ledger-row foot projects-grid">
              <div>Total</div>
              <div></div>
              <div className="num">{formatHours(totalMinutes)}h</div>
              <div className="num">{formatMoney(totalEarned)}</div>
              <div></div>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>05 /</b> Detailed entries
          </div>
        </div>
        {/* Pass empty currentUserId + isAdmin=false so action buttons hide. */}
        <EntriesGrouped
          entries={entries}
          projects={projects}
          currentUserId=""
          isAdmin={false}
          emptyText="No entries in this period."
        />
      </section>
    </main>
  );
}
