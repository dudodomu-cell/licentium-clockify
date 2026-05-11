"use client";

import { useState } from "react";
import {
  deleteEntryAction,
  startTimerAction,
  updateEntryAction,
} from "@/app/actions";
import {
  durationMinutes,
  formatDuration,
  formatMoney,
  formatTime,
  toDateTimeLocal,
} from "@/lib/format";
import { sameTzDay, tzDayDelta } from "@/lib/tz";
import type { EntryWithJoins, Project } from "@/lib/types";
import { useViewerTz } from "./viewer-tz-provider";

type Props = {
  entries: EntryWithJoins[];
  projects: Project[];
  currentUserId: string;
  isAdmin: boolean;
  emptyText?: string;
};

export function EntriesTable({
  entries,
  projects,
  currentUserId,
  isAdmin,
  emptyText = "No entries.",
}: Props) {
  const viewerTz = useViewerTz();
  if (entries.length === 0) {
    return <div className="form mute" style={{ textAlign: "center" }}>{emptyText}</div>;
  }

  const totalMinutes = entries.reduce(
    (sum, e) => sum + durationMinutes(e.starts_at, e.ends_at),
    0,
  );
  const totalEarned = entries.reduce(
    (sum, e) =>
      sum + (durationMinutes(e.starts_at, e.ends_at) / 60) * Number(e.rate),
    0,
  );

  return (
    <div className="ledger">
      <div className="ledger-row head entries-grid">
        <div>Description</div>
        <div>Project</div>
        <div>Who</div>
        <div className="num">Start</div>
        <div className="num">End</div>
        <div className="num">Duration</div>
        <div className="num">Amount</div>
        <div></div>
      </div>
      {entries.map((e) => (
        <EntryRow
          key={e.id}
          entry={e}
          projects={projects}
          canEdit={isAdmin || e.user_id === currentUserId}
          viewerTz={viewerTz}
        />
      ))}
      <div className="ledger-row foot entries-grid">
        <div>Total</div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div className="num">{formatDuration(totalMinutes)}</div>
        <div className="num">{formatMoney(totalEarned)}</div>
        <div></div>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  projects,
  canEdit,
  viewerTz,
}: {
  entry: EntryWithJoins;
  projects: Project[];
  canEdit: boolean;
  viewerTz: string;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (editing) {
    return (
      <EntryEditRow
        entry={entry}
        projects={projects}
        onDone={() => setEditing(false)}
        viewerTz={viewerTz}
      />
    );
  }

  const minutes = durationMinutes(entry.starts_at, entry.ends_at);
  const amount = (minutes / 60) * Number(entry.rate);
  const running = entry.ends_at === null;
  // Cross-midnight indicator: how many local days the entry spans.
  const dayDelta = !running && entry.ends_at
    ? tzDayDelta(entry.starts_at, entry.ends_at, viewerTz)
    : 0;

  const handleDelete = async (formData: FormData) => {
    if (!confirm("Delete this entry?")) return;
    setDeleting(true);
    try {
      await deleteEntryAction(formData);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="ledger-row entries-grid"
      style={running ? { background: "rgba(94,234,212,0.04)" } : undefined}
    >
      <div className="label-cell">
        {entry.description || <span className="mute">—</span>}
        {running && (
          <span className="pill" style={{ marginLeft: 8, color: "var(--accent)", borderColor: "var(--accent)" }}>
            running
          </span>
        )}
      </div>
      <div>
        {entry.project_name ? (
          <span className="pill solid">
            <span
              className="dot"
              style={{ background: entry.project_color ?? "#5eead4" }}
            />
            {entry.project_name}
          </span>
        ) : (
          <span className="mute">—</span>
        )}
      </div>
      <div>
        <span className="pill user">{entry.user_name}</span>
      </div>
      <div className="num date-cell">{formatTime(entry.starts_at, viewerTz)}</div>
      <div className="num date-cell">
        {entry.ends_at ? (
          <>
            {formatTime(entry.ends_at, viewerTz)}
            {dayDelta > 0 && (
              <span
                className="pill"
                style={{
                  marginLeft: 6,
                  fontSize: 9,
                  padding: "1px 5px",
                  color: "var(--warning)",
                  borderColor: "var(--warning)",
                }}
                title={`Ends ${dayDelta} day${dayDelta === 1 ? "" : "s"} later`}
              >
                +{dayDelta}d
              </span>
            )}
          </>
        ) : (
          <span className="dim">—</span>
        )}
      </div>
      <div className="num">{formatDuration(minutes)}</div>
      <div className="num">{formatMoney(amount)}</div>
      <div className="row-actions">
        <form action={startTimerAction} style={{ display: "inline" }}>
          <input type="hidden" name="description" value={entry.description} />
          <input
            type="hidden"
            name="project_id"
            value={entry.project_id ?? ""}
          />
          <button
            type="submit"
            className="row-icon go"
            title="Resume this task"
            aria-label="Resume"
          >
            ▶
          </button>
        </form>
        {canEdit && (
          <>
            <button
              type="button"
              className="row-icon"
              onClick={() => setEditing(true)}
              title="Edit"
              aria-label="Edit"
            >
              ✎
            </button>
            <form action={handleDelete}>
              <input type="hidden" name="id" value={entry.id} />
              <button
                type="submit"
                className="row-icon danger"
                title="Delete"
                aria-label="Delete"
                disabled={deleting}
              >
                ×
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function EntryEditRow({
  entry,
  projects,
  onDone,
  viewerTz,
}: {
  entry: EntryWithJoins;
  projects: Project[];
  onDone: () => void;
  viewerTz: string;
}) {
  const handle = async (formData: FormData) => {
    await updateEntryAction(formData);
    onDone();
  };

  return (
    <form
      action={handle}
      className="form"
      style={{ margin: 0, border: "none", borderTop: "1px solid var(--accent)", borderBottom: "1px solid var(--accent)", borderRadius: 0 }}
    >
      <input type="hidden" name="id" value={entry.id} />
      <div className="form-grid">
        <label className="field" style={{ gridColumn: "span 2" }}>
          Description
          <input
            className="input"
            name="description"
            defaultValue={entry.description}
            autoFocus
          />
        </label>
        <label className="field">
          Project
          <select
            className="select"
            name="project_id"
            defaultValue={entry.project_id ?? ""}
          >
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
            defaultValue={toDateTimeLocal(entry.starts_at, viewerTz)}
            required
          />
        </label>
        <label className="field">
          End
          <input
            className="input"
            type="datetime-local"
            name="ends_at"
            defaultValue={toDateTimeLocal(entry.ends_at, viewerTz)}
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
            defaultValue={entry.rate}
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
