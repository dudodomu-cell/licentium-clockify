import { getSupabaseServer } from "./supabase/server";
import type { EntryWithJoins, Profile, Project } from "./types";

// ---------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------

export async function fetchProfiles(): Promise<Profile[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

// ---------------------------------------------------------------
// Projects
// ---------------------------------------------------------------

export async function fetchProjects(opts: { includeArchived?: boolean } = {}): Promise<Project[]> {
  const supabase = await getSupabaseServer();
  let q = supabase.from("projects").select("*").order("name");
  if (!opts.includeArchived) q = q.eq("archived", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Project[];
}

// ---------------------------------------------------------------
// Time entries
// ---------------------------------------------------------------

export type EntriesFilter = {
  since?: string;
  until?: string;
  userId?: string;
  projectId?: string;
  // Include the running entry even if it falls outside [since, until).
  // (Used on the dashboard so a long-running timer started yesterday still
  // shows up on today's view.)
  includeRunning?: boolean;
};

type RawJoinRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  description: string;
  starts_at: string;
  ends_at: string | null;
  rate: number | string;
  created_at: string;
  updated_at: string;
  profiles: { full_name: string; email: string } | null;
  projects: { name: string; color: string } | null;
};

function mapEntry(row: RawJoinRow): EntryWithJoins {
  return {
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    description: row.description,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    rate: Number(row.rate),
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_name: row.profiles?.full_name ?? "—",
    user_email: row.profiles?.email ?? "",
    project_name: row.projects?.name ?? null,
    project_color: row.projects?.color ?? null,
  };
}

export async function fetchEntries(filter: EntriesFilter = {}): Promise<EntryWithJoins[]> {
  const supabase = await getSupabaseServer();

  const select = "*, profiles(full_name, email), projects(name, color)";
  let q = supabase.from("time_entries").select(select).order("starts_at", { ascending: false });

  if (filter.since) q = q.gte("starts_at", filter.since);
  if (filter.until) q = q.lt("starts_at", filter.until);
  if (filter.userId) q = q.eq("user_id", filter.userId);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as unknown as RawJoinRow[];

  if (filter.includeRunning) {
    // Re-fetch any running entries (ends_at IS NULL) that wouldn't match the
    // since/until window because they started before it. Merge unique.
    let runQ = supabase
      .from("time_entries")
      .select(select)
      .is("ends_at", null);
    if (filter.userId) runQ = runQ.eq("user_id", filter.userId);
    if (filter.projectId) runQ = runQ.eq("project_id", filter.projectId);
    const { data: runData, error: runErr } = await runQ;
    if (runErr) throw runErr;

    const seen = new Set(rows.map((r) => r.id));
    for (const r of (runData ?? []) as unknown as RawJoinRow[]) {
      if (!seen.has(r.id)) {
        rows = [r, ...rows];
        seen.add(r.id);
      }
    }
  }

  return rows.map(mapEntry);
}

export async function fetchRunningEntry(userId: string): Promise<EntryWithJoins | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*, profiles(full_name, email), projects(name, color)")
    .eq("user_id", userId)
    .is("ends_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapEntry(data as unknown as RawJoinRow);
}
