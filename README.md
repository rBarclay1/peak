# Peak

Personal climbing, golf, food, sleep, and day planner for November 2–20, 2026.
React / Vite / Tailwind, Supabase persistence, Vercel functions, installable PWA.

## Run and verify

```sh
npm ci
cp .env.example .env.local
# Fill in the public Supabase client configuration.
npm run dev
npm test
npx playwright install chromium webkit
npm run test:e2e
npm run build
```

Browser tests use an isolated mock database, including production-build offline
reloads. They never write to the production account.

## Daily plan

The timeline includes the 6:30 wake-up, morning running logistics, work and class,
meals, training, evening free time, and 10 pm bedtime. Check off items, mark partial
completion, move flexible items, skip, or undo. The To-do list supports optional
deadlines, editing, completion, deletion with undo, and finding a free evening slot.
Dates, session details, schedule constraints and nutrition defaults live in
`src/lib/plan.js`. Fuel targets can be edited in the app. The initial targets are
120 g protein and a provisional 2,550 kcal; shortfalls do not accumulate as debt.

Missed training folds into the next suitable session without adding volume. The
final recovery days are protected. Unfinished to-dos return to the backlog.
Past dates never count as completed just because time has passed. Food review
distinguishes incomplete logging from confirmed shortfalls. Old journal data is
preserved; the journal is no longer displayed.

## Persistence and existing data

The deployed project has `schedule_overrides`, `nutrition_logs`, `saved_meals`,
`garmin_data`, and `weight_log`. Its `training_sessions` table is absent, so the new
planner deliberately does not depend on it. Each planner item uses a separate
versioned `schedule_overrides` row (`user_id` prefix
`placeholder-user:peak-november-v1:`), with its record in `day_overrides`.
The original summer schedule row and old logs are untouched. No migration is
required for the existing deployment. Do not rerun the legacy `schema.sql` as an
upgrade migration.

Planner edits and nutrition mutations persist locally before network requests,
retry after reconnection, and use stable identities to prevent duplicate saves.
Manual sleep is stored separately from Garmin measurements. Keep the same site
origin on your phone to retain existing local data.

This remains the existing single-user prototype: public client access and no
user login. It is not a private multi-user product. Adding authentication requires
an explicit ownership migration and RLS policies for all existing records; do not
simply enable RLS and strand the current logs.

## Deployment

The existing Vercel project is `summergrind`, connected to this repository.
`ANTHROPIC_API_KEY` stays server-side and powers `/api/estimate`. Garmin credentials
and its scheduled sync are retained. Set `CRON_SECRET` in production for the
protected `/api/rollover` job, scheduled at 05:10 UTC (00:10 New York in this block;
Vercel's plan determines scheduling precision). Rollover also catches up on app
open, focus, reconnection and while the app is visible. Unuploaded offline edits
cannot be processed by the server until the device reconnects.

The service worker caches the app shell and hashed assets, never API responses.
