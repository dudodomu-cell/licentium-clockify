import { getSupabaseServer } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions";
import { NavLinks } from "./nav-links";

export async function TopBar() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, is_admin")
    .eq("id", user.id)
    .single();

  const display = profile?.full_name ?? user.email ?? "user";

  return (
    <header className="top">
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
