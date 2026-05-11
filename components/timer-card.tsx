"use client";

import { useEffect, useState } from "react";
import { startTimerAction, stopTimerAction } from "@/app/actions";
import { formatTimer } from "@/lib/format";
import type { Project, TimeEntry } from "@/lib/types";

type Paused = { description: string; project_id: string | null };
const STORAGE_KEY = "clockify_paused_task";

function readPaused(): Paused | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.description !== "string") return null;
    return {
      description: parsed.description,
      project_id: parsed.project_id ?? null,
    };
  } catch {
    return null;
  }
}

export function TimerCard({
  running,
  projects,
}: {
  running: TimeEntry | null;
  projects: Project[];
}) {
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState<Paused | null>(null);

  // Hydrate paused state on mount. We intentionally don't read localStorage
  // during SSR — it doesn't exist there.
  useEffect(() => {
    setPaused(readPaused());
  }, []);

  // Starting a fresh timer (or auto-stopping the paused one) invalidates any
  // stale paused state.
  useEffect(() => {
    if (running && paused) {
      window.localStorage.removeItem(STORAGE_KEY);
      setPaused(null);
    }
  }, [running, paused]);

  // Tick the running clock once per second.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Pause: save resume context BEFORE the form submits to stopTimerAction.
  const handlePauseSubmit = () => {
    if (!running) return;
    const p: Paused = {
      description: running.description,
      project_id: running.project_id,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    setPaused(p);
  };

  // Stop: explicit "done" — wipe any paused context so the banner doesn't
  // reappear after the page revalidates.
  const handleStopSubmit = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setPaused(null);
  };

  const dismissPaused = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setPaused(null);
  };

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
        <div className="timer-buttons">
          <form action={stopTimerAction} onSubmit={handlePauseSubmit}>
            <button
              type="submit"
              className="btn lg"
              title="Pause — saves resume context"
            >
              ⏸ Pause
            </button>
          </form>
          <form action={stopTimerAction} onSubmit={handleStopSubmit}>
            <button
              type="submit"
              className="btn primary lg"
              title="Stop the timer"
            >
              ■ Stop
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {paused && (
        <PausedBanner
          paused={paused}
          projects={projects}
          onDismiss={dismissPaused}
        />
      )}
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
    </>
  );
}

function PausedBanner({
  paused,
  projects,
  onDismiss,
}: {
  paused: Paused;
  projects: Project[];
  onDismiss: () => void;
}) {
  const project = projects.find((p) => p.id === paused.project_id);
  return (
    <form action={startTimerAction} className="paused-banner">
      <input type="hidden" name="description" value={paused.description} />
      <input
        type="hidden"
        name="project_id"
        value={paused.project_id ?? ""}
      />
      <div className="paused-banner-info">
        <span className="paused-label">⏸ Paused</span>
        <span className="paused-desc">
          {paused.description || (
            <span className="dim">(no description)</span>
          )}
        </span>
        {project && (
          <span className="pill solid">
            <span
              className="dot"
              style={{ background: project.color }}
            />
            {project.name}
          </span>
        )}
      </div>
      <div className="paused-banner-actions">
        <button type="submit" className="btn primary">
          ▶ Resume
        </button>
        <button
          type="button"
          className="btn"
          onClick={onDismiss}
          title="Discard paused task"
        >
          ×
        </button>
      </div>
    </form>
  );
}
