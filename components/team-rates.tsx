"use client";

import { useState } from "react";
import { updateProfileAction } from "@/app/actions";
import { formatMoney } from "@/lib/format";
import type { Profile } from "@/lib/types";

export function TeamRates({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  return (
    <div className="ledger">
      <div
        className="ledger-row head"
        style={{ gridTemplateColumns: "1.4fr 1.6fr 0.8fr 0.6fr auto" }}
      >
        <div>Name</div>
        <div>Email</div>
        <div className="num">Default rate</div>
        <div>Role</div>
        <div></div>
      </div>
      {profiles.map((p) => (
        <TeamRow key={p.id} profile={p} isSelf={p.id === currentUserId} />
      ))}
    </div>
  );
}

function TeamRow({ profile, isSelf }: { profile: Profile; isSelf: boolean }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <TeamEditRow profile={profile} onDone={() => setEditing(false)} />;
  }

  return (
    <div
      className="ledger-row"
      style={{ gridTemplateColumns: "1.4fr 1.6fr 0.8fr 0.6fr auto" }}
    >
      <div className="label-cell">
        {profile.full_name}
        {isSelf && <span className="pill" style={{ marginLeft: 8 }}>you</span>}
      </div>
      <div className="mute" style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
        {profile.email}
      </div>
      <div className="num">
        {formatMoney(Number(profile.default_rate))}/hr
      </div>
      <div className="mute">{profile.is_admin ? "Admin" : "Member"}</div>
      <div className="row-actions">
        <button
          type="button"
          className="row-icon"
          onClick={() => setEditing(true)}
          title="Edit"
        >
          ✎
        </button>
      </div>
    </div>
  );
}

function TeamEditRow({
  profile,
  onDone,
}: {
  profile: Profile;
  onDone: () => void;
}) {
  const handle = async (formData: FormData) => {
    await updateProfileAction(formData);
    onDone();
  };

  return (
    <form
      action={handle}
      className="form"
      style={{
        margin: 0,
        border: "none",
        borderTop: "1px solid var(--accent)",
        borderBottom: "1px solid var(--accent)",
        borderRadius: 0,
      }}
    >
      <input type="hidden" name="target_id" value={profile.id} />
      <div className="form-grid">
        <label className="field" style={{ gridColumn: "span 2" }}>
          Full name
          <input
            className="input"
            name="full_name"
            defaultValue={profile.full_name}
            required
            autoFocus
          />
        </label>
        <label className="field">
          Default rate $/hr
          <input
            className="input num"
            type="number"
            step="0.01"
            min="0"
            name="default_rate"
            defaultValue={profile.default_rate}
            required
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn primary">
          Save
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
