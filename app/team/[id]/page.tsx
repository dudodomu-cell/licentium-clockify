import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  fetchEntries,
  fetchPayments,
  fetchProfiles,
  fetchProjects,
} from "@/lib/db";
import {
  durationMinutes,
  formatDuration,
  formatMoney,
} from "@/lib/format";
import { EntriesGrouped } from "@/components/entries-grouped";
import { PaymentsList } from "@/components/payments-list";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function TeamDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const me = await requireAdmin();

  const profiles = await fetchProfiles();
  const target = profiles.find((p) => p.id === id);
  if (!target) notFound();

  const [entries, payments, projects] = await Promise.all([
    fetchEntries({ userId: id }),
    fetchPayments({ userId: id }),
    fetchProjects({ includeArchived: true }),
  ]);

  // Aggregate
  let totalMinutes = 0;
  let totalEarned = 0;
  for (const e of entries) {
    if (e.ends_at === null) continue;
    const m = durationMinutes(e.starts_at, e.ends_at);
    totalMinutes += m;
    totalEarned += (m / 60) * Number(e.rate);
  }
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalEarned - totalPaid;

  // Per-project breakdown for this user.
  type B = { name: string; color: string; minutes: number; earned: number };
  const byProject = new Map<string, B>();
  for (const e of entries) {
    if (e.ends_at === null) continue;
    const m = durationMinutes(e.starts_at, e.ends_at);
    const earned = (m / 60) * Number(e.rate);
    const key = e.project_id ?? "__none__";
    const prev =
      byProject.get(key) ?? {
        name: e.project_name ?? "(no project)",
        color: e.project_color ?? "#444",
        minutes: 0,
        earned: 0,
      };
    byProject.set(key, {
      ...prev,
      minutes: prev.minutes + m,
      earned: prev.earned + earned,
    });
  }
  const projectRows = [...byProject.values()].sort(
    (a, b) => b.minutes - a.minutes,
  );

  return (
    <main>
      <div style={{ marginBottom: 24 }}>
        <Link href="/team" className="btn">
          ← Team
        </Link>
      </div>

      <div className="hero">
        <h1>{target.full_name}</h1>
        <p>
          <span className="dim" style={{ fontFamily: "var(--font-mono)" }}>
            {target.email}
          </span>
          {" · "}
          {target.is_admin ? "Admin" : "Member"}
          {" · "}
          Default rate {formatMoney(Number(target.default_rate))}/hr
        </p>
      </div>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>01 /</b> Stats
          </div>
          <div className="section-num mute">all time</div>
        </div>
        <div className="grid">
          <div className="card">
            <div className="card-label">Hours</div>
            <div>
              <div className="card-value">{formatDuration(totalMinutes)}</div>
              <div className="card-sub">
                {entries.length} entr{entries.length === 1 ? "y" : "ies"}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-label">Earned</div>
            <div>
              <div className="card-value">{formatMoney(totalEarned)}</div>
              <div className="card-sub">at the rates entered per row</div>
            </div>
          </div>
          <div className="card">
            <div className="card-label">Paid</div>
            <div>
              <div className="card-value">{formatMoney(totalPaid)}</div>
              <div className="card-sub">
                {payments.length} payment
                {payments.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-label">Balance</div>
            <div>
              <div
                className={`card-value ${balance > 0 ? "warn" : balance < 0 ? "pos" : ""}`}
              >
                {balance < 0 ? "−" : ""}
                {formatMoney(Math.abs(balance))}
              </div>
              <div className="card-sub">
                {balance > 0
                  ? "owed"
                  : balance < 0
                    ? "prepaid"
                    : "settled"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {projectRows.length > 0 && (
        <section>
          <div className="section-head">
            <div className="section-num">
              <b>02 /</b> Per project
            </div>
          </div>
          <div className="ledger">
            <div
              className="ledger-row head"
              style={{ gridTemplateColumns: "1.6fr 0.8fr 0.8fr 0.8fr" }}
            >
              <div>Project</div>
              <div className="num">Share</div>
              <div className="num">Hours</div>
              <div className="num">Earned</div>
            </div>
            {projectRows.map((r) => {
              const share =
                totalMinutes > 0 ? (r.minutes / totalMinutes) * 100 : 0;
              return (
                <div
                  key={r.name}
                  className="ledger-row"
                  style={{ gridTemplateColumns: "1.6fr 0.8fr 0.8fr 0.8fr" }}
                >
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
                  <div className="num">{formatDuration(r.minutes)}</div>
                  <div className="num">{formatMoney(r.earned)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>{projectRows.length > 0 ? "03 /" : "02 /"}</b> Payments
          </div>
        </div>
        <PaymentsList
          payments={payments}
          profiles={profiles}
          currentUserId={me.id}
          isAdmin={me.is_admin}
        />
      </section>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>{projectRows.length > 0 ? "04 /" : "03 /"}</b> Entries
          </div>
        </div>
        <EntriesGrouped
          entries={entries}
          projects={projects}
          currentUserId={me.id}
          isAdmin={me.is_admin}
          emptyText="No entries yet."
        />
      </section>
    </main>
  );
}
