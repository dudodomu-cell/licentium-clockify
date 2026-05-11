"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// On first mount in any browser, read the browser's IANA timezone and write
// it to the viewer_tz cookie. Triggers a router.refresh so server-rendered
// content picks up the new TZ immediately. After that, the cookie persists
// for a year and only re-writes if the browser TZ changes (travel etc).
const COOKIE_NAME = "viewer_tz";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function ViewerTzWriter() {
  const router = useRouter();

  useEffect(() => {
    let tz: string;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;

    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.split("=")[1];

    if (current === tz) return;

    document.cookie =
      `${COOKIE_NAME}=${tz}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
    // Re-render server components with the new cookie applied.
    router.refresh();
  }, [router]);

  return null;
}
