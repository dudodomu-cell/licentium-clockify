"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Msg = { kind: "ok" | "err"; text: string } | null;

export function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(
    initialError ? { kind: "err", text: initialError } : null,
  );

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setMsg(null);
    try {
      const supabase = getSupabaseBrowser();
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const redirectTo = `${siteUrl}/auth/callback${
        next ? `?next=${encodeURIComponent(next)}` : ""
      }`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setMsg({
        kind: "ok",
        text: `Magic link sent to ${email}. Check your inbox.`,
      });
    } catch (e: unknown) {
      const text =
        e instanceof Error ? e.message : "Something went wrong. Try again.";
      setMsg({ kind: "err", text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={handle}>
        <label className="field">
          Email
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@licentium.io"
            autoFocus
            autoComplete="email"
          />
        </label>
        <button
          type="submit"
          className="btn primary lg"
          disabled={busy || !email}
        >
          {busy ? "Sending…" : "Send magic link"}
        </button>
      </form>
      {msg && <div className={`auth-msg ${msg.kind}`}>{msg.text}</div>}
    </>
  );
}
