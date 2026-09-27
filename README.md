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

* Company monitoring
* Job collection
* Greenhouse
* Lever
* Ashby
* Job database
* AI classification
* AI matching
* Dashboard
* Saved jobs
* Application tracking

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
