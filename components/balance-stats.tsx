import { formatHours, formatMoney } from "@/lib/format";
import type { UserBalance } from "@/lib/types";

export function BalanceStats({ balances }: { balances: UserBalance[] }) {
  if (balances.length === 0) {
    return (
      <div className="form mute" style={{ textAlign: "center" }}>
        No team members yet.
      </div>
    );
  }

  let teamEarned = 0;
  let teamPaid = 0;
  for (const b of balances) {
    teamEarned += b.total_earned;
    teamPaid += b.total_paid;
  }
  const teamBalance = teamEarned - teamPaid;

  return (
    <div className="grid">
      <div className="card">
        <div className="card-label">Team owed</div>
        <div>
          <div
            className={`card-value ${teamBalance > 0 ? "warn" : teamBalance < 0 ? "pos" : ""}`}
          >
            {teamBalance < 0 ? "−" : ""}
            {formatMoney(Math.abs(teamBalance))}
          </div>
          <div className="card-sub">
            {formatMoney(teamEarned)} earned · {formatMoney(teamPaid)} paid
          </div>
        </div>
      </div>
      {balances.map((b) => {
        const owed = b.balance > 0;
        const prepaid = b.balance < 0;
        const owedHours = b.default_rate > 0 ? Math.abs(b.balance) / b.default_rate : 0;
        return (
          <div className="card" key={b.user_id}>
            <div className="card-label">{b.user_name}</div>
            <div>
              <div
                className={`card-value ${owed ? "warn" : prepaid ? "pos" : ""}`}
              >
                {prepaid ? "−" : ""}
                {formatMoney(Math.abs(b.balance))}
              </div>
              <div className="card-sub">
                {owed
                  ? `owed · ${formatHours(b.total_minutes)}h logged · ${
                      b.default_rate > 0
                        ? `${formatHours(owedHours * 60)}h to clear`
                        : "no rate set"
                    }`
                  : prepaid
                    ? `prepaid · ${formatHours(b.total_minutes)}h logged`
                    : `settled · ${formatHours(b.total_minutes)}h logged`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
