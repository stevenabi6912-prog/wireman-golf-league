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
import { getSupabaseClient, isSupabaseConfigured } from "./supabase/client";

interface AuthValue {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
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

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) return { error: "Auth is not configured." };
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) return { error: "Auth is not configured." };
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) return { error: error.message };
    // With email confirmation OFF, signUp returns a session immediately.
    if (!data.session) {
      return {
        error:
          "Account created, but email confirmation is on. Turn off 'Confirm email' in Supabase → Authentication → Providers → Email, then sign in.",
      };
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await getSupabaseClient()?.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ configured, ready, session, signIn, signUp, signOut }),
    [configured, ready, session, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
