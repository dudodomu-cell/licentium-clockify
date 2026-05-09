import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { computeBalances } from "@/lib/db";
import { formatDuration, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await requireAdmin();
  const balances = await computeBalances();

  return (
    <main>
      <div className="hero">
        <h1>Team</h1>
        <p>
          Everyone, with their hours and money at a glance. Click a card to
          see all of someone&rsquo;s entries, projects, and payments in one
          place.
        </p>
      </div>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>01 /</b> Members
          </div>
          <div className="section-num mute">
            {balances.length} {balances.length === 1 ? "person" : "people"}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            background: "var(--border)",
            border: "1px solid var(--border)",
          }}
        >
          {balances.map((b) => {
            const owed = b.balance > 0;
            const prepaid = b.balance < 0;
            return (
              <Link
                key={b.user_id}
                href={`/team/${b.user_id}`}
                style={{
                  background: "var(--bg-elev)",
                  padding: "22px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  textDecoration: "none",
                  color: "var(--text)",
                  transition: "background 0.15s",
                  minHeight: 160,
                }}
              >
                <div className="card-label">{b.user_name}</div>
                <div
                  className="dim"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.05em",
                  }}
                >
                  {b.user_email}
                </div>
                <div style={{ marginTop: "auto" }}>
                  <div
                    className={`card-value ${owed ? "warn" : prepaid ? "pos" : ""}`}
                    style={{ fontSize: 24 }}
                  >
                    {prepaid ? "−" : ""}
                    {formatMoney(Math.abs(b.balance))}
                  </div>
                  <div className="card-sub">
                    {formatDuration(b.total_minutes)} ·{" "}
                    {formatMoney(b.total_earned)} earned ·{" "}
                    {formatMoney(b.total_paid)} paid
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
