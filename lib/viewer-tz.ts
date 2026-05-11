import "server-only";

import { cookies } from "next/headers";
import { TEAM_TZ } from "./tz";

// Name shared between the server reader (here) and the client writer
// (components/viewer-tz-writer.tsx).
export const VIEWER_TZ_COOKIE = "viewer_tz";

// Reads the viewer's timezone from the cookie set on first visit by
// <ViewerTzWriter />. Falls back to TEAM_TZ on first request (before the
// client has run) or if the value isn't a recognized IANA zone.
export async function getViewerTz(): Promise<string> {
  const c = await cookies();
  const tz = c.get(VIEWER_TZ_COOKIE)?.value;
  if (!tz) return TEAM_TZ;
  try {
    // Construct a formatter — throws on unknown zones.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return TEAM_TZ;
  }
}
