import { getCurrentProfile } from "@/lib/auth";
import {
  computeBalances,
  fetchEntries,
  fetchProfiles,
  fetchProjects,
  fetchRunningEntry,
} from "@/lib/db";
import { TimerCard } from "@/components/timer-card";
import { EntriesGrouped } from "@/components/entries-grouped";
import { ManualEntryForm } from "@/components/manual-entry-form";
import { WeekStats } from "@/components/week-stats";
import { BalanceStats } from "@/components/balance-stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();

  const [projects, profiles, running, balances] = await Promise.all([
    fetchProjects(),
    fetchProfiles(),
    fetchRunningEntry(profile.id),
    computeBalances(),
  ]);

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const entries = await fetchEntries({
    since: sevenDaysAgo,
    includeRunning: true,
  });

  return (
    <main>
      <div className="hero">
        <h1>
          Track time.<br />
          Send invoices.
        </h1>
        <p>
          Start the clock, type what you&rsquo;re working on, hit Start. When
          billing day comes around, generate the invoice from{" "}
          <i>Invoices &rarr; Create</i> and email the PDF.
        </p>
      </div>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>01 /</b> Timer
          </div>
        </div>
        <TimerCard running={running} projects={projects} />
      </section>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>02 /</b> Recent entries
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
          emptyText="No time logged in the last 7 days."
        />
      </section>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>03 /</b> Last 7 days
          </div>
        </div>
        <WeekStats entries={entries} profiles={profiles} />
      </section>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>04 /</b> Balance
          </div>
          <div className="section-num mute">all time · earned − paid</div>
        </div>
        <BalanceStats balances={balances} />
      </section>
    </main>
  );
}
