import { LoginForm } from "@/components/login-form";

type SearchParams = Promise<{ next?: string; error?: string }>;

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed":
    "This email isn't on the allowlist. Ping Dmytro or Illia to be added.",
  "callback-failed":
    "Magic link couldn't be exchanged for a session. Try requesting a fresh one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const initialError = sp.error ? ERROR_MESSAGES[sp.error] ?? sp.error : undefined;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: 24 }}>
          § <b>Licentium</b> Clockify
        </div>
        <h2>Sign in</h2>
        <p>Enter your work email — we&rsquo;ll send a magic link.</p>
        <LoginForm next={sp.next} initialError={initialError} />
      </div>
    </div>
  );
}
