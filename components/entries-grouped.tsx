"use client";

import { EntriesTable } from "./entries-table";
import { formatDate } from "@/lib/format";
import type { EntryWithJoins, Project } from "@/lib/types";

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function todayKey(): string {
  return localDayKey(new Date().toISOString());
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDayKey(d.toISOString());
}

export function EntriesGrouped({
  entries,
  projects,
  currentUserId,
  isAdmin,
  emptyText,
}: {
  entries: EntryWithJoins[];
  projects: Project[];
  currentUserId: string;
  isAdmin: boolean;
  emptyText?: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="form mute" style={{ textAlign: "center" }}>
        {emptyText ?? "No entries."}
      </div>
    );
  }

  const groups = new Map<string, EntryWithJoins[]>();
  for (const e of entries) {
    const k = localDayKey(e.starts_at);
    const arr = groups.get(k);
    if (arr) arr.push(e);
    else groups.set(k, [e]);
  }
  const days = [...groups.keys()].sort().reverse();
  const today = todayKey();
  const yesterday = yesterdayKey();
  const label = (k: string) =>
    k === today ? "TODAY" : k === yesterday ? "YESTERDAY" : formatDate(k);

  return (
    <>
      {days.map((day, i) => (
        <div key={day} style={{ marginBottom: i === days.length - 1 ? 0 : 32 }}>
          <div
            className="section-num"
            style={{ marginBottom: 10, color: "var(--text)" }}
          >
            <b>{label(day)}</b>
          </div>
          <EntriesTable
            entries={groups.get(day)!}
            projects={projects}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        </div>
      ))}
    </>
  );
}
