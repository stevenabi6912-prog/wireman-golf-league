"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  authRedirectUrl,
  getSupabaseClient,
  isSupabaseConfigured,
} from "./supabase/client";

interface AuthValue {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  signIn: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (!configured) return;
    const client = getSupabaseClient();
    if (!client) {
      setReady(true);
      return;
    }
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = client.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  const signIn = useCallback(async (email: string) => {
    const client = getSupabaseClient();
    if (!client) return { error: "Auth is not configured." };
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    return error ? { error: error.message } : {};
  }, []);

  const signOut = useCallback(async () => {
    await getSupabaseClient()?.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ configured, ready, session, signIn, signOut }),
    [configured, ready, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
