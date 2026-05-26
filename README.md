# Wireman Family Golf League

Mobile-first web app to track a 12-round family golf league at Ella Sharp Park
(Jackson, MI). Live Stableford scoring against each player's personal handicap,
season standings, and handicap-review recommendations after rounds 3, 6, and 9.

Built to work **offline** at the course — all data lives in `localStorage`.

## Tech

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- `localStorage` persistence behind a swappable `SeasonStore` interface
  (`lib/storage/`) so a network backend (e.g. Supabase) can be added later
  without touching UI code

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # scoring + integration unit tests (vitest)
npm run build    # production build
```

## Scoring (pure functions in `lib/scoring.ts`)

- Personal par = course par + player handicap
- Stableford: eagle 4 / birdie 3 / par 2 / bogey 1 / else 0
- Max strokes = PP + 3 (PP + 2 in scramble); pickups score 0
- Scramble team PP = `ceil((pp1 + pp2) / 2)`; both teammates get the team score
- Round 12 (Championship) doubles points toward season totals
- Handicap review: avg > 22 → tighten −1 (floor 0); avg < 14 → loosen +1

All of the above is covered by unit tests in `lib/*.test.ts`.

## Backup

Settings → Export/Import JSON backs up and restores the entire season.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new) — Vercel
   auto-detects Next.js; no extra config needed.
3. Deploy. There are no environment variables for v1.
