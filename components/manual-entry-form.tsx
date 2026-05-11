"use client";

import { useState } from "react";
import { createEntryAction } from "@/app/actions";
import { toDateTimeLocal } from "@/lib/format";
import type { Project } from "@/lib/types";
import { useViewerTz } from "./viewer-tz-provider";

export function ManualEntryForm({
  projects,
  defaultRate,
}: {
  projects: Project[];
  defaultRate: number;
}) {
  const [open, setOpen] = useState(false);
  const viewerTz = useViewerTz();

  const handle = async (formData: FormData) => {
    await createEntryAction(formData);
    setOpen(false);
  };

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="btn"
          onClick={() => setOpen(true)}
        >
          + Add manual entry
        </button>
      </div>
    );
  }

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  return (
    <form action={handle} className="form">
      <div className="form-grid">
        <label className="field" style={{ gridColumn: "span 2" }}>
          Description
          <input
            className="input"
            name="description"
            placeholder="What did you work on?"
            autoFocus
          />
        </label>
        <label className="field">
          Project
          <select className="select" name="project_id" defaultValue="">
            <option value="">— no project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Start
          <input
            className="input"
            type="datetime-local"
            name="starts_at"
            defaultValue={toDateTimeLocal(hourAgo, viewerTz)}
            required
          />
        </label>
        <label className="field">
          End
          <input
            className="input"
            type="datetime-local"
            name="ends_at"
            defaultValue={toDateTimeLocal(now, viewerTz)}
            required
          />
        </label>
        <label className="field">
          Rate $/hr
          <input
            className="input num"
            type="number"
            step="0.01"
            min="0"
            name="rate"
            defaultValue={defaultRate}
            required
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn primary">
          Save entry
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
