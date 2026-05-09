"use client";

import { useEffect, useState } from "react";
import { startTimerAction, stopTimerAction } from "@/app/actions";
import { formatTimer } from "@/lib/format";
import type { Project, TimeEntry } from "@/lib/types";

export function TimerCard({
  running,
  projects,
}: {
  running: TimeEntry | null;
  projects: Project[];
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (running) {
    const startMs = new Date(running.starts_at).getTime();
    const seconds = Math.max(0, Math.floor((now - startMs) / 1000));
    const project = projects.find((p) => p.id === running.project_id);
    const startTime = new Date(running.starts_at).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <div className="timer running">
        <div className="timer-info">
          <div className="desc">
            {running.description || (
              <span className="dim">(no description)</span>
            )}
          </div>
          <div className="meta">
            {project ? (
              <>
                <span
                  className="dot"
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: project.color,
                    marginRight: 6,
                    verticalAlign: "middle",
                  }}
                />
                {project.name}
              </>
            ) : (
              "no project"
            )}
            {" · started "}
            {startTime}
          </div>
        </div>
        <div className="timer-display running">{formatTimer(seconds)}</div>
        <form action={stopTimerAction}>
          <button type="submit" className="btn primary lg">
            Stop
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={startTimerAction} className="timer">
      <input
        className="input"
        name="description"
        placeholder="What are you working on?"
        autoComplete="off"
      />
      <select className="select" name="project_id" defaultValue="">
        <option value="">— no project —</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="timer-display dim">00:00:00</div>
      <button type="submit" className="btn primary lg">
        Start
      </button>
    </form>
  );
}
