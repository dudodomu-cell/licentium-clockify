"use client";

import { useState } from "react";
import {
  createProjectAction,
  deleteProjectAction,
  toggleArchiveProjectAction,
  updateProjectAction,
} from "@/app/actions";
import { formatDuration, formatMoney } from "@/lib/format";
import type { Project } from "@/lib/types";

type Stats = { minutes: number; earned: number; users: number };

export function ProjectsList({
  projects,
  stats,
}: {
  projects: Project[];
  stats: Map<string, Stats>;
}) {
  const active = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);

  return (
    <>
      <NewProjectButton />
      <ProjectTable projects={active} stats={stats} title="Active" emptyText="No active projects yet — create one above." />
      {archived.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <ProjectTable
            projects={archived}
            stats={stats}
            title="Archived"
            emptyText=""
          />
        </div>
      )}
    </>
  );
}

function NewProjectButton() {
  const [open, setOpen] = useState(false);

  const handle = async (fd: FormData) => {
    await createProjectAction(fd);
    setOpen(false);
  };

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => setOpen(true)}>
          + New project
        </button>
      </div>
    );
  }

  return (
    <form action={handle} className="form">
      <div className="form-grid">
        <label className="field" style={{ gridColumn: "span 2" }}>
          Name
          <input
            className="input"
            name="name"
            placeholder="LinkedIn outreach"
            autoFocus
            required
          />
        </label>
        <label className="field">
          Client
          <input
            className="input"
            name="client"
            placeholder="(optional)"
          />
        </label>
        <label className="field">
          Color
          <input
            className="input"
            type="color"
            name="color"
            defaultValue="#5eead4"
            style={{ height: 38, padding: 4 }}
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn primary">
          Create
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ProjectTable({
  projects,
  stats,
  title,
  emptyText,
}: {
  projects: Project[];
  stats: Map<string, Stats>;
  title: string;
  emptyText: string;
}) {
  if (projects.length === 0) {
    if (!emptyText) return null;
    return (
      <div className="form mute" style={{ textAlign: "center" }}>
        {emptyText}
      </div>
    );
  }

  return (
    <>
      <div
        className="section-num"
        style={{ marginBottom: 10, color: "var(--text)" }}
      >
        <b>{title.toUpperCase()}</b>
      </div>
      <div className="ledger">
        <div className="ledger-row head projects-grid">
          <div>Project</div>
          <div>Client</div>
          <div className="num">Hours</div>
          <div className="num">Amount</div>
          <div></div>
        </div>
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} stats={stats.get(p.id)} />
        ))}
      </div>
    </>
  );
}

function ProjectRow({
  project,
  stats,
}: {
  project: Project;
  stats: Stats | undefined;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <ProjectEditRow project={project} onDone={() => setEditing(false)} />;
  }

  const minutes = stats?.minutes ?? 0;
  const earned = stats?.earned ?? 0;

  const archive = async (formData: FormData) => {
    await toggleArchiveProjectAction(formData);
  };
  const remove = async (formData: FormData) => {
    if (
      !confirm(
        `Delete project "${project.name}"? Existing entries keep their hours but lose the project tag.`,
      )
    )
      return;
    await deleteProjectAction(formData);
  };

  return (
    <div className="ledger-row projects-grid">
      <div className="label-cell">
        <span className="pill solid">
          <span className="dot" style={{ background: project.color }} />
          {project.name}
        </span>
      </div>
      <div className="mute">{project.client ?? "—"}</div>
      <div className="num">{formatDuration(minutes)}</div>
      <div className="num">{formatMoney(earned)}</div>
      <div className="row-actions">
        <button
          type="button"
          className="row-icon"
          onClick={() => setEditing(true)}
          title="Edit"
        >
          ✎
        </button>
        <form action={archive} style={{ display: "inline" }}>
          <input type="hidden" name="id" value={project.id} />
          <input
            type="hidden"
            name="archived"
            value={String(project.archived)}
          />
          <button
            type="submit"
            className="row-icon"
            title={project.archived ? "Unarchive" : "Archive"}
          >
            {project.archived ? "↺" : "▣"}
          </button>
        </form>
        <form action={remove} style={{ display: "inline" }}>
          <input type="hidden" name="id" value={project.id} />
          <button
            type="submit"
            className="row-icon danger"
            title="Delete"
          >
            ×
          </button>
        </form>
      </div>
    </div>
  );
}

function ProjectEditRow({
  project,
  onDone,
}: {
  project: Project;
  onDone: () => void;
}) {
  const handle = async (formData: FormData) => {
    await updateProjectAction(formData);
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
      <input type="hidden" name="id" value={project.id} />
      <input
        type="hidden"
        name="archived"
        value={String(project.archived)}
      />
      <div className="form-grid">
        <label className="field" style={{ gridColumn: "span 2" }}>
          Name
          <input
            className="input"
            name="name"
            defaultValue={project.name}
            required
            autoFocus
          />
        </label>
        <label className="field">
          Client
          <input
            className="input"
            name="client"
            defaultValue={project.client ?? ""}
          />
        </label>
        <label className="field">
          Color
          <input
            className="input"
            type="color"
            name="color"
            defaultValue={project.color}
            style={{ height: 38, padding: 4 }}
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
