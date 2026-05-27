"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Loading } from "@/components/ui";

/**
 * When Supabase is configured, requires an email + password session before
 * showing the app. In local-only mode (no backend) it renders children.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { configured, ready, session } = useAuth();

  if (!configured) return <>{children}</>;
  if (!ready) return <Loading />;
  if (session) return <>{children}</>;
  return <SignIn />;
}

function SignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 6;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const fn = mode === "create" ? signUp : signIn;
    const { error: err } = await fn(email, password);
    setBusy(false);
    if (err) setError(err);
    // On success the auth listener flips `session` and the gate opens.
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-extrabold" style={{ color: "var(--forest)" }}>
        Wireman Golf League
      </h1>
      <p className="mt-1 text-muted">
        {mode === "create"
          ? "Create the shared family login."
          : "Sign in to sync across phones."}
      </p>

      <form onSubmit={submit} className="card mt-6 space-y-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="surface w-full rounded-xl border px-4 py-3 text-base"
          style={{ borderColor: "var(--border)" }}
        />
        <input
          type="password"
          autoComplete={mode === "create" ? "new-password" : "current-password"}
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          disabled={busy || !canSubmit}
          className="btn btn-primary w-full py-3"
          style={busy || !canSubmit ? { opacity: 0.5 } : undefined}
        >
          {busy
            ? "Please wait…"
            : mode === "create"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <button
        className="mt-4 text-sm font-semibold"
        style={{ color: "var(--navy)" }}
        onClick={() => {
          setMode((m) => (m === "create" ? "signin" : "create"));
          setError(null);
        }}
      >
        {mode === "create"
          ? "Already set up? Sign in"
          : "First time? Create the family account"}
      </button>
    </div>
  );
}
