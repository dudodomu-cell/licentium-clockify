import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchEntries } from "@/lib/db";
import {
  rangeFromDates,
  rangeFromPreset,
  type Preset,
} from "@/lib/range";
import { durationMinutes, formatDate, formatTime } from "@/lib/format";
import { getViewerTz } from "@/lib/viewer-tz";

const PRESETS = new Set<Preset>([
  "today",
  "yesterday",
  "thisWeek",
  "thisMonth",
  "lastMonth",
  "all",
]);

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  // Middleware already gated authentication; this is a defence-in-depth check
  // in case the route is hit directly. CSV export contains money, so it's
  // gated to admins only.
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams);
  const viewerTz = await getViewerTz();

  let range;
  if (sp.from || sp.to) {
    range = rangeFromDates(sp.from ?? null, sp.to ?? null, viewerTz);
  } else if (sp.preset && PRESETS.has(sp.preset as Preset)) {
    range = rangeFromPreset(sp.preset as Preset, viewerTz);
  } else {
    range = rangeFromPreset("thisMonth", viewerTz);
  }

  const entries = await fetchEntries({
    since: range.from?.toISOString(),
    until: range.to?.toISOString(),
    userId: sp.user || undefined,
    projectId: sp.project || undefined,
  });

  // Sort ascending by start time so the CSV reads chronologically.
  const sorted = [...entries].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  );

  const header = [
    "Date",
    "Start",
    "End",
    "User",
    "Email",
    "Project",
    "Description",
    "Hours",
    "Rate",
    "Amount",
  ];

  const rows = sorted.map((e) => {
    const m = durationMinutes(e.starts_at, e.ends_at);
    const hours = m / 60;
    const amount = hours * Number(e.rate);
    return [
      formatDate(e.starts_at, viewerTz),
      formatTime(e.starts_at, viewerTz),
      e.ends_at ? formatTime(e.ends_at, viewerTz) : "",
      e.user_name,
      e.user_email,
      e.project_name ?? "",
      e.description,
      hours.toFixed(2),
      Number(e.rate).toFixed(2),
      amount.toFixed(2),
    ];
  });

  const csv = [header, ...rows]
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n");

  const fname = `licentium-clockify-${range.label
    .replace(/[^\w]+/g, "-")
    .toLowerCase()}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
