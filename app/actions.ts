"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function requireUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function strOrNull(form: FormData, key: string): string | null {
  const v = str(form, key);
  return v === "" ? null : v;
}

function num(form: FormData, key: string, fallback = 0): number {
  const v = form.get(key);
  if (typeof v !== "string") return fallback;
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/projects");
  revalidatePath("/export");
}

// ---------------------------------------------------------------
// Auth
// ---------------------------------------------------------------

export async function signOutAction() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------
// Timer (start/stop)
// ---------------------------------------------------------------

export async function startTimerAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const description = str(formData, "description");
  const projectId = strOrNull(formData, "project_id");

  // Stop any currently-running timer for this user — Clockify-style: starting
  // a new one auto-stops the previous one. Without this the unique partial
  // index on running entries would refuse the insert.
  const now = new Date().toISOString();
  await supabase
    .from("time_entries")
    .update({ ends_at: now })
    .eq("user_id", user.id)
    .is("ends_at", null);

  // Pick rate from the user's profile default.
  const { data: profile } = await supabase
    .from("profiles")
    .select("default_rate")
    .eq("id", user.id)
    .single();

  const rate = Number(profile?.default_rate ?? 0);

  await supabase.from("time_entries").insert({
    user_id: user.id,
    project_id: projectId,
    description,
    starts_at: now,
    ends_at: null,
    rate,
  });

  refresh();
}

export async function stopTimerAction() {
  const { supabase, user } = await requireUser();
  await supabase
    .from("time_entries")
    .update({ ends_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("ends_at", null);
  refresh();
}

// ---------------------------------------------------------------
// Time entries CRUD
// ---------------------------------------------------------------

// Manual entry — start/end specified by hand.
export async function createEntryAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const description = str(formData, "description");
  const projectId = strOrNull(formData, "project_id");
  const startsAt = str(formData, "starts_at");
  const endsAt = str(formData, "ends_at");
  const rate = num(formData, "rate");

  if (!startsAt || !endsAt) {
    throw new Error("Start and end times are required for manual entries.");
  }

  await supabase.from("time_entries").insert({
    user_id: user.id,
    project_id: projectId,
    description,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    rate,
  });

  refresh();
}

export async function updateEntryAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) throw new Error("Entry id missing.");

  const description = str(formData, "description");
  const projectId = strOrNull(formData, "project_id");
  const startsAt = str(formData, "starts_at");
  const endsAt = strOrNull(formData, "ends_at");
  const rate = num(formData, "rate");

  const patch: Record<string, unknown> = {
    description,
    project_id: projectId,
    starts_at: new Date(startsAt).toISOString(),
    rate,
  };
  patch.ends_at = endsAt ? new Date(endsAt).toISOString() : null;

  // RLS enforces that only the owner (or an admin) can perform this update.
  const { error } = await supabase
    .from("time_entries")
    .update(patch)
    .eq("id", id);
  if (error) throw error;

  refresh();
}

export async function deleteEntryAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) throw new Error("Entry id missing.");

  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) throw error;

  refresh();
}

// ---------------------------------------------------------------
// Projects CRUD
// ---------------------------------------------------------------

export async function createProjectAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = str(formData, "name");
  const client = strOrNull(formData, "client");
  const color = str(formData, "color") || "#5eead4";
  if (!name) throw new Error("Project name required.");

  const { error } = await supabase.from("projects").insert({
    name,
    client,
    color,
    created_by: user.id,
  });
  if (error) throw error;

  refresh();
}

export async function updateProjectAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) throw new Error("Project id missing.");

  const name = str(formData, "name");
  const client = strOrNull(formData, "client");
  const color = str(formData, "color") || "#5eead4";
  const archived = str(formData, "archived") === "true";

  const { error } = await supabase
    .from("projects")
    .update({ name, client, color, archived })
    .eq("id", id);
  if (error) throw error;

  refresh();
}

export async function toggleArchiveProjectAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  const archived = str(formData, "archived") === "true";

  const { error } = await supabase
    .from("projects")
    .update({ archived: !archived })
    .eq("id", id);
  if (error) throw error;

  refresh();
}

export async function deleteProjectAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) throw new Error("Project id missing.");

  // Existing entries will keep `project_id = NULL` after delete (FK ON DELETE
  // SET NULL), so historical hours aren't lost.
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;

  refresh();
}

// ---------------------------------------------------------------
// Profile
// ---------------------------------------------------------------

export async function updateProfileAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const fullName = str(formData, "full_name");
  const defaultRate = num(formData, "default_rate");
  // Optional target_id — admins can edit other people's rates by passing this.
  // RLS rejects the write if a non-admin tries to set target_id ≠ self.
  const targetId = strOrNull(formData, "target_id") ?? user.id;

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, default_rate: defaultRate })
    .eq("id", targetId);
  if (error) throw error;

  refresh();
}
