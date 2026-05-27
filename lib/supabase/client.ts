import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Whether a Supabase backend is configured at build time. When false the app
 * runs in local-only mode (the original single-device behavior) — no auth wall,
 * no network calls. This keeps the deployed app working before the env secrets
 * are added.
 */
export function isSupabaseConfigured(): boolean {
  return URL.length > 0 && ANON_KEY.length > 0;
}

let client: SupabaseClient | null = null;

/** Singleton browser Supabase client, or null when not configured / on server. */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (typeof window === "undefined") return null;
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

/** Production GitHub Pages base path; empty in local dev. */
export function getBasePath(): string {
  return process.env.NODE_ENV === "production" ? "/wireman-golf-league" : "";
}

/** Where Supabase should send the magic-link callback. */
export function authRedirectUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${getBasePath()}/`;
}

export const PHOTO_BUCKET = "golf-photos";
