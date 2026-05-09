import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = new Set<string>(["/login"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/favicon")) return true;
  return false;
}

function allowedEmails(): Set<string> {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() validates the JWT against Supabase. Don't rely on
  // getSession() here — that just reads the cookie blindly.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public route — let it through, but if the user is already signed in send
  // them to the dashboard rather than the login screen.
  if (isPublicPath(pathname)) {
    if (user && pathname === "/login") {
      const dest = request.nextUrl.clone();
      dest.pathname = "/";
      return NextResponse.redirect(dest);
    }
    return response;
  }

  // Protected route + no session → bounce to login.
  if (!user) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/login";
    dest.searchParams.set("next", pathname);
    return NextResponse.redirect(dest);
  }

  // Allowlist enforcement. If somehow a non-allowed email got a session
  // (e.g. someone signed in before being removed from ALLOWED_EMAILS), kick
  // them out.
  const allow = allowedEmails();
  const email = (user.email ?? "").toLowerCase();
  if (allow.size > 0 && !allow.has(email)) {
    await supabase.auth.signOut();
    const dest = request.nextUrl.clone();
    dest.pathname = "/login";
    dest.searchParams.set("error", "not-allowed");
    return NextResponse.redirect(dest);
  }

  return response;
}
