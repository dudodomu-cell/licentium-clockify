"use client";

import { useEffect } from "react";
import { formatTimer } from "@/lib/format";

const BASE_TITLE = "Licentium Clockify";

// When a timer is running, show `[HH:MM:SS] Licentium Clockify` in the
// browser tab title — visible from any page in the app, hard to forget.
export function TimerTitle({
  running,
}: {
  running: { starts_at: string } | null;
}) {
  useEffect(() => {
    if (!running) {
      document.title = BASE_TITLE;
      return;
    }

    const startMs = new Date(running.starts_at).getTime();
    const tick = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      document.title = `[${formatTimer(seconds)}] ${BASE_TITLE}`;
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      document.title = BASE_TITLE;
    };
  }, [running]);

  return null;
}
