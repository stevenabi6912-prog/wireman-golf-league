"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Loading } from "@/components/ui";

/**
 * When Supabase is configured, requires a magic-link session before showing the
 * app. In local-only mode (no backend configured) it renders children directly.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { configured, ready, session } = useAuth();

  if (!configured) return <>{children}</>;
  if (!ready) return <Loading />;
  if (session) return <>{children}</>;
  return <SignIn />;
}

function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("wireman.golf@gmail.com");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(email.trim());
    setBusy(false);
    if (err) setError(err);
    else setSent(true);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-extrabold" style={{ color: "var(--forest)" }}>
        Wireman Golf League
      </h1>
      <p className="mt-1 text-muted">Sign in to sync across phones.</p>

      {sent ? (
        <div className="card mt-6">
          <p className="font-bold" style={{ color: "var(--gold)" }}>
            Check your email
          </p>
          <p className="mt-1 text-sm text-muted">
            We sent a magic link to <strong>{email}</strong>. Open it on this
            device to finish signing in.
          </p>
          <button
            className="btn btn-outline mt-4 w-full py-3"
            onClick={() => setSent(false)}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="card mt-6 space-y-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="wireman.golf@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="surface w-full rounded-xl border px-4 py-3 text-base"
            style={{ borderColor: "var(--border)" }}
          />
          {error && (
            <p className="text-sm" style={{ color: "#b91c1c" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="btn btn-primary w-full py-3"
            style={busy || !email.trim() ? { opacity: 0.5 } : undefined}
          >
            {busy ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}
    </div>
  );
}
