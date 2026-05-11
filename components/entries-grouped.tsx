"use client";

import { EntriesTable } from "./entries-table";
import { formatDate } from "@/lib/format";
import { tzAddDays, tzYmd } from "@/lib/tz";
import type { EntryWithJoins, Project } from "@/lib/types";
import { useViewerTz } from "./viewer-tz-provider";

function dayKey(d: Date, tz: string): string {
  const { year, month, day } = tzYmd(d, tz);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  const viewerTz = useViewerTz();

  if (entries.length === 0) {
    return (
      <div className="form mute" style={{ textAlign: "center" }}>
        {emptyText ?? "No entries."}
      </div>
    );
  }

  const groups = new Map<string, EntryWithJoins[]>();
  for (const e of entries) {
    const k = dayKey(new Date(e.starts_at), viewerTz);
    const arr = groups.get(k);
    if (arr) arr.push(e);
    else groups.set(k, [e]);
  }
  const days = [...groups.keys()].sort().reverse();
  const today = dayKey(new Date(), viewerTz);
  const yesterday = dayKey(tzAddDays(new Date(), -1, viewerTz), viewerTz);
  const label = (k: string) =>
    k === today ? "TODAY" : k === yesterday ? "YESTERDAY" : formatDate(k, viewerTz);

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
