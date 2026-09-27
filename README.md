# JobScout AI

AI powered personal job discovery and matching platform.

## What it does

JobScout AI automatically discovers public job listings from configured companies and sources, analyzes them using AI, and helps the user identify relevant opportunities.

## Core workflow

```text
Company Career Page
        â†“
Job Source API
        â†“
Job Ingestion
        â†“
Normalization
        â†“
Duplicate Detection
        â†“
Database
        â†“
AI Analysis
        â†“
Profile Matching
        â†“
Dashboard
        â†“
User Decides
        â†“
Apply
```

## Current MVP

Implemented:

* Company monitoring (Greenhouse + Ashby public boards)
* Job collection, normalisation, cross-source dedupe
* Job database with row level security
* AI classification and skill extraction
* AI profile matching with explainable scores
* Dashboard, Discover, Saved jobs, Applications, Companies, Profile, Settings
* Telegram high-match alerts

Not built yet: email/password authentication. The app resolves a single viewer from the
`profiles` table (or `SUPABASE_USER_ID`), so the RLS policies in the initial migration are
not yet exercised by a real session.

Lever is intentionally absent: its public `api.lever.co/v0/postings/*` endpoints answer 404
for every board tested, and the authenticated `v1` endpoints need an account key. See
`API_SOURCES.md`.

## Tech Stack

* Next.js
* React
* TypeScript
* Tailwind CSS
* Supabase
* PostgreSQL
* OpenAI API

## Philosophy

The goal is not to collect as many jobs as possible.

The goal is to surface the jobs that are actually relevant.

AI assists with research and analysis.

The user remains in control of applications.

## Development

```bash
npm run dev
npm run typecheck
npm run lint
```

Read `PROMPT.md` and `AGENT.md` before making major changes.

Build incrementally.

Do not attempt to implement the entire roadmap in a single step.

---

## Supabase setup

The app runs without a database, in demo mode. To make it real:

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run the migrations in order:
   * `supabase/migrations/20260927000000_initial_schema.sql`
   * `supabase/migrations/20260927001000_ingestion_fields.sql`
3. Copy the values from **Project Settings → API** into `.env.local`:
   * `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `SUPABASE_SERVICE_ROLE_KEY` (server only, bypasses RLS, never expose it)
4. Create one user with your own password under **Authentication → Users → Add user**.
5. Open `supabase/seed.sql`, replace `replace-me@example.com` with that email, and run it
   in the SQL editor. It looks the user up by email and inserts the matching
   `profiles` row, so no credentials or fixed UUID are committed here.
6. Restart `npm run dev`. The top bar switches from `Demo data` to the live source.

The profile row matters: it is the single account every saved job, application, and match
is attributed to until authentication exists. The seeded preferences use the exact keys the
code reads, `target_roles`, `preferred_locations`, `employment_types`, `remote_only`,
`min_match_score`, and `notify_telegram`. Anything else you add to that jsonb is ignored.

Optional: set `SUPABASE_USER_ID` to that user's UUID. It only matters when more than one
profile row exists, since the app otherwise takes the first row.

### Local Supabase instead of a hosted project

With Docker running and the [Supabase CLI](https://supabase.com/docs/guides/cli)
installed:

```bash
supabase start        # applies supabase/migrations, then supabase/seed.sql
supabase status       # prints the local API URL and keys
supabase stop
```

---

## Ingestion

`POST /api/ingest` runs a full scan of every active company.

Send `Authorization: Bearer <CRON_SECRET>`. When `CRON_SECRET` is unset the route
only accepts requests outside production.

```bash
# Preview without writing anything (uses the default company list)
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true,"includeSamples":5}'

# Persist to Supabase
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

`GET /api/ingest` reports which sources are supported and which credentials are present.

### Scheduled scans

`vercel.json` runs a daily scan at 06:00 UTC against `GET /api/cron/ingest`. Vercel cron
only issues GET requests, which is why this route exists alongside the POST API above. It
requires the same `CRON_SECRET`, and Vercel sends `Authorization: Bearer $CRON_SECRET`
automatically once that variable is set in the project.

The Hobby plan allows at most two cron jobs, each no more frequent than daily. Scoring is
deliberately not scheduled: running the model on a timer spends money without anyone
watching, so `POST /api/analyze` stays a manual step from Settings.

---

## Telegram notifications

Sent from the server only. `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are never
exposed to the browser.

```bash
# Send a connectivity test message
curl -X POST http://localhost:3000/api/notifications/telegram \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode":"test"}'

# Preview which jobs would be reported (dry run)
curl -X POST http://localhost:3000/api/notifications/telegram \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode":"digest","dryRun":true}'
```

The digest only reports roles that already have a `job_matches` score at or above
the threshold, and skips anything already recorded in `notification_log`.

---

## AI analysis and matching

`POST /api/analyze` classifies stored roles and scores them against the profile.

`GET /api/analyze` reports the configured model and which credentials are present.

```bash
# Show the exact messages that would be sent, without calling OpenAI
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"inspectPrompts":true,"limit":3,"maxCompanies":2}'

# Score stored jobs and write job_skills + job_matches (needs OPENAI_API_KEY)
curl -X POST http://localhost:3000/api/analyze \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode":"run","limit":5,"concurrency":2,"postedWithinDays":30}'
```

Modes:

* `inspectPrompts` builds the prompts from live board data and returns them. No OpenAI call.
* `preview` fetches live board data and runs the model without writing to the database.
* `run` reads stored jobs, runs the model, and persists skills and matches.

`pendingOnly` (default `true`, DB mode only) skips jobs that already have a match newer than
the job row, so repeated runs do not pay to re-score unchanged postings.

Job descriptions are untrusted input. They are isolated inside XML-ish tags, explicitly
labelled as data, and the system prompt forbids obeying any instruction found inside them.
Everything the model returns is a strict JSON schema; scores are estimates for a human
decision, never a hiring prediction.

---

## The app

| Route | Purpose |
| --- | --- |
| `/` | Ranked feed with stats, filters and the match breakdown modal |
| `/discover` | Every stored role, including roles AI scoring has not reached |
| `/saved` | Bookmarked roles |
| `/applications` | Pipeline tracking with per-application notes |
| `/companies` | Monitored boards, add/pause, last scan status |
| `/profile` | The exact profile context sent to the matching model |
| `/settings` | Run ingestion, analysis and the Telegram digest; credential status |

The app runs without Supabase by falling back to the seed data in `src/data/seed-data.ts`
and says so in the top bar. Saving, application tracking and company management need
Supabase and report a clear reason instead of failing silently.

