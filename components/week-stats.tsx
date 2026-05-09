import { durationMinutes, formatHours, formatMoney } from "@/lib/format";
import type { EntryWithJoins, Profile } from "@/lib/types";

type UserBucket = {
  user_id: string;
  name: string;
  minutes: number;
  earned: number;
};

export function WeekStats({
  entries,
  profiles,
}: {
  entries: EntryWithJoins[];
  profiles: Profile[];
}) {
  const buckets = new Map<string, UserBucket>();
  let totalMinutes = 0;
  let totalEarned = 0;

  for (const e of entries) {
    const m = durationMinutes(e.starts_at, e.ends_at);
    const earned = (m / 60) * Number(e.rate);
    totalMinutes += m;
    totalEarned += earned;
    const prev = buckets.get(e.user_id) ?? {
      user_id: e.user_id,
      name: e.user_name,
      minutes: 0,
      earned: 0,
    };
    buckets.set(e.user_id, {
      user_id: prev.user_id,
      name: prev.name,
      minutes: prev.minutes + m,
      earned: prev.earned + earned,
    });
  }

  // Surface every team member, even those with zero hours this week.
  for (const p of profiles) {
    if (!buckets.has(p.id)) {
      buckets.set(p.id, {
        user_id: p.id,
        name: p.full_name,
        minutes: 0,
        earned: 0,
      });
    }
  }

  const rows = [...buckets.values()].sort((a, b) => b.minutes - a.minutes);

  return (
    <div className="grid">
      <div className="card">
        <div className="card-label">Team total</div>
        <div>
          <div className="card-value">{formatHours(totalMinutes)}h</div>
          <div className="card-sub">{formatMoney(totalEarned)}</div>
        </div>
      </div>
      {rows.map((u) => (
        <div className="card" key={u.user_id}>
          <div className="card-label">{u.name}</div>
          <div>
            <div className="card-value">{formatHours(u.minutes)}h</div>
            <div className="card-sub">{formatMoney(u.earned)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
