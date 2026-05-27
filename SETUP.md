# Cloud Sync Setup (Supabase + GitHub Pages)

The app works in **local-only mode** until these steps are done — no auth wall,
no network. Completing them turns on multi-phone sync and photos. Nothing here
changes the existing single-device behavior until the env secrets are present.

## 1. Create the Supabase project

- In your Supabase org, create a new project (region: `us-east-2` is closest to Michigan).
- Grab the project's **URL** and **anon/public key** from Project Settings → API.
  - Use the bare **Project URL** — `https://<ref>.supabase.co` with **no trailing
    slash and no path**. Do NOT use the "RESTful endpoint" value (`…/rest/v1/`);
    the client appends its own paths, so an extra `/rest/v1/` causes
    "Invalid path specified in request URL" errors at sign-in.

## 2. Run the schema migration

- Open Supabase → **SQL Editor**.
- Create the storage bucket first (next step) OR run everything except the
  storage-policy block, then create the bucket, then run that block.
- Paste and run [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql).
  It creates the tables, enables Row Level Security, and adds policies (a single
  shared family account → any authenticated user has full access).

## 3. Create the photo storage bucket

- Storage → **New bucket** → name it **`golf-photos`**, check **Public bucket**.
- The storage policies at the bottom of the migration file allow public read and
  authenticated write/update/delete.

## 4. Configure email + password auth

Authentication → **Providers → Email**:

- Make sure **Email** is enabled.
- Turn **OFF "Confirm email."** This lets you create the shared family login and
  sign in instantly — no emails sent, so no magic-link rate limits.

(URL Configuration isn't required for password sign-in, but setting the Site URL
to the GitHub Pages URL is harmless.)

## 5. Add the GitHub Actions secrets

Repo → Settings → Secrets and variables → **Actions** → New repository secret:

- `NEXT_PUBLIC_SUPABASE_URL` = your project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon/public key

The `NEXT_PUBLIC_` prefix is required — these are baked into the browser bundle
at build time. The anon key is meant to be public; RLS protects the data.

## 6. Re-run the deploy

- Actions → **Deploy to GitHub Pages** → Run workflow (or push any commit to `main`).
- The build injects the secrets (see `.github/workflows/deploy.yml`).

## 7. Create the login and sign in

- Open the site → tap **"First time? Create the family account"** → enter an
  email and a password (6+ characters) → **Create account**. You're signed in
  immediately (no email).
- On every other phone, open the site → enter the same email + password →
  **Sign in**. Each device stays signed in afterward (use a normal tab or the
  Home Screen app — not a private/incognito tab).
- On the phone that has your existing rounds, tap **"Upload existing season"**
  on the Dashboard to push them to the cloud.

## Checklist

- [ ] Create Supabase project (`us-east-2`)
- [ ] Run `supabase/migrations/001_initial.sql`
- [ ] Create the `golf-photos` bucket (public read)
- [ ] Authentication → Providers → Email → turn OFF "Confirm email"
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` Actions secrets
- [ ] Re-run the deploy workflow
- [ ] Create the family login, sign in on both phones, upload the existing season

## How it behaves

- **Offline-first:** every score writes to the local cache instantly. Pending
  cloud writes queue in `localStorage` and flush on reconnect. The header shows
  Synced / Syncing / Offline; tap it to inspect the queue.
- **Realtime:** changes from the other phone arrive within a few seconds.
- **Conflicts:** last write wins per row; in practice each phone scores
  different players, so collisions are rare.

## Rollback

If anything misbehaves after deploy:

1. **Sign out** (Settings) — the app keeps working in local-only mode off the cache.
2. **Settings → Export season as JSON** for a safety backup.
3. The schema is additive; nothing in the existing app was removed.
