"use client";

import { useState } from "react";
import { updateProfileAction } from "@/app/actions";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [saved, setSaved] = useState(false);

  const handle = async (formData: FormData) => {
    setSaved(false);
    await updateProfileAction(formData);
    setSaved(true);
  };

  return (
    <form action={handle} className="form">
      <div className="form-grid">
        <label className="field" style={{ gridColumn: "span 2" }}>
          Full name
          <input
            className="input"
            name="full_name"
            defaultValue={profile.full_name}
            required
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
        <label className="field">
          Email <span className="dim">(read-only)</span>
          <input
            className="input"
            type="email"
            value={profile.email}
            disabled
            readOnly
          />
        </label>
        <label className="field">
          Role <span className="dim">(read-only)</span>
          <input
            className="input"
            value={profile.is_admin ? "Admin" : "Member"}
            disabled
            readOnly
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn primary">
          Save
        </button>
        {saved && (
          <span
            className="auth-msg ok"
            style={{ margin: 0, padding: "8px 12px" }}
          >
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
