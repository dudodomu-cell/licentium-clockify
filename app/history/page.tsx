import { getCurrentProfile } from "@/lib/auth";
import { fetchEntries, fetchProfiles, fetchProjects } from "@/lib/db";
import { rangeFromDates, rangeFromPreset, type Preset } from "@/lib/range";
import { EntriesGrouped } from "@/components/entries-grouped";
import { FilterBar } from "@/components/filter-bar";
import { ManualEntryForm } from "@/components/manual-entry-form";
import { WeekStats } from "@/components/week-stats";
import { durationMinutes, formatHours, formatMoney } from "@/lib/format";

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

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const profile = await getCurrentProfile();

  // Default range: this month, unless the URL says otherwise.
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

  const totalMinutes = entries.reduce(
    (s, e) => s + durationMinutes(e.starts_at, e.ends_at),
    0,
  );
  const totalEarned = entries.reduce(
    (s, e) =>
      s + (durationMinutes(e.starts_at, e.ends_at) / 60) * Number(e.rate),
    0,
  );

  return (
    <main>
      <div className="hero">
        <h1>History</h1>
        <p>
          Everything anyone tracked. Filter by user, project, or date range.
          Edit your own entries inline; admins can edit anyone&rsquo;s.
        </p>
      </div>

      <section>
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
            preset: sp.from || sp.to ? undefined : preset || "thisMonth",
          }}
          basePath="/history"
        />
      </section>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>02 /</b> Totals
          </div>
        </div>
        <div className="grid">
          <div className="card">
            <div className="card-label">Hours</div>
            <div>
              <div className="card-value">{formatHours(totalMinutes)}h</div>
              <div className="card-sub">
                {entries.length} entr{entries.length === 1 ? "y" : "ies"}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-label">Amount</div>
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
            <b>04 /</b> Entries
          </div>
        </div>
        <ManualEntryForm
          projects={projects}
          defaultRate={Number(profile.default_rate)}
        />
        <EntriesGrouped
          entries={entries}
          projects={projects}
          currentUserId={profile.id}
          isAdmin={profile.is_admin}
          emptyText="No entries match those filters."
        />
      </section>
    </main>
  );
}
