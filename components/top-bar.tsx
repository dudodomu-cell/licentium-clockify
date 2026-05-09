import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchRunningEntry } from "@/lib/db";
import { signOutAction } from "@/app/actions";
import { NavLinks } from "./nav-links";
import { TimerTitle } from "./timer-title";

export async function TopBar() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, running] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, is_admin")
      .eq("id", user.id)
      .single(),
    fetchRunningEntry(user.id),
  ]);

  const display = profile?.full_name ?? user.email ?? "user";

  return (
    <header className="top">
      <TimerTitle running={running} />
      <div className="top-inner">
        <div className="brand">
          § <b>Licentium</b> Clockify
        </div>
        <nav className="nav">
          <NavLinks />
          <span className="who">
            <b>{display}</b>
            {profile?.is_admin ? <span className="dim"> · admin</span> : null}
            <form action={signOutAction}>
              <button type="submit">Sign out</button>
            </form>
          </span>
        </nav>
      </div>
    </header>
  );
}
