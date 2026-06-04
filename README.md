# Peak

A summer climbing training tracker. Installable PWA, dark Whoop-inspired UI.

**Stack:** React (Vite) · Tailwind CSS · Supabase (auth + DB) · React Router · PWA (manifest + service worker)

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL + anon key
npm run dev
```

Open http://localhost:5173.

### Environment variables

| Var | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

## Database

Run [`schema.sql`](./schema.sql) in the Supabase SQL editor. It creates the
`daily_logs`, `nutrition_logs`, `saved_meals`, `garmin_data`, and
`training_sessions` tables and enables Row Level Security so each user can only
read/write their own rows.

## PWA / icons

`public/icons/` ships placeholder icons. Regenerate them with:

```bash
node scripts/gen-icons.mjs
```

Replace `icon-192.png` / `icon-512.png` with real artwork when ready.

## Structure

```
src/
  components/   BottomNav, PageStub
  pages/        Today, Fuel, Trends   (stubs for now)
  lib/          supabase.js
  hooks/        (empty — for later)
  App.jsx       routes + layout
  main.jsx      entry + service worker registration
```

This is the app **shell** — auth UI and real data come in later prompts.
