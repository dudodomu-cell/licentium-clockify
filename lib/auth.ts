import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabase/server";
import type { Profile } from "./types";

// Resolves the current user's profile or redirects to /login. Use at the top
// of every protected page.
export async function getCurrentProfile(): Promise<Profile> {
  return getCurrentProfileImpl();
}

// Same but bounces non-admins to the dashboard. Use at the top of admin-only
// pages (invoices, export, team).
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfileImpl();
  if (!profile.is_admin) redirect("/");
  return profile;
}

async function getCurrentProfileImpl(): Promise<Profile> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // Profile row missing — schema trigger should always create one, but if a
    // user existed before the trigger was installed, fall back to a stub.
    return {
      id: user.id,
      email: user.email ?? "",
      full_name: (user.email ?? "user").split("@")[0],
      default_rate: 0,
      is_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return profile as Profile;
}

// True iff `email` is in the comma-separated ADMIN_EMAILS env var. Used as a
// defence-in-depth check on the server (the DB also has its own is_admin).
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? "";
  const set = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return set.has(email.toLowerCase());
}
