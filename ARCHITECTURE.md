# JobScout AI Architecture

## High Level

```text
                    USER
                     │
                     ↓
              NEXT.JS FRONTEND
                     │
          ┌──────────┴──────────┐
          ↓                     ↓
      SUPABASE              AI SERVICE
          │                     │
          ↓                     ↓
      POSTGRESQL        JOB ANALYSIS
          │                     │
          └──────────┬──────────┘
                     ↓
              JOB INGESTION
                     │
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
  Greenhouse       Lever         Ashby
       │             │             │
       └─────────────┼─────────────┘
                      ↓
                 NORMALIZER
                      ↓
               DUPLICATE CHECK
                      ↓
                 JOB DATABASE
```

Note: the diagram originally listed Lever between Greenhouse and Ashby. Lever has no
reachable public endpoint in this build, so the ingestion registry currently resolves
Greenhouse and Ashby only. See `API_SOURCES.md`.

---

## Module Map

```text
src/app/(app)/        Server-rendered pages: dashboard, discover, saved, applications,
                      companies, profile, settings. All are dynamic.
src/app/api/          ingest, analyze, notifications/telegram. CRON_SECRET guarded.
src/lib/sources/      ATS adapters, bounded fetch with retries, HTML to plain text.
src/lib/ingestion/    Normalizer, dedupe, default company list, orchestrator.
src/lib/ai/           OpenAI client, strict schemas, prompts, analysis, orchestrator.
src/lib/notifications/  Telegram transport and high-match notification rules.
src/lib/data/         Server-only read layer and credential capability probe.
src/lib/actions/      Server Functions: saved jobs, applications, profile, companies,
                      and the pipeline runners.
src/lib/supabase/     Browser and server Supabase clients.
```

Reads go through `src/lib/data/queries.ts`, which has two providers behind one contract:
Supabase rows when configured, and the seed data in `src/data/seed-data.ts` when not. The
top bar always states which provider is active, so demo data is never presented as live.
Mutations live in `src/lib/actions/`, are Server Functions, and re-check the viewer and the
credentials on every call.

---

## Components

### Frontend

Responsibilities:

* Dashboard
* Job search
* Job details
* Profile settings
* Company management
* Application tracking
* Match explanations

Status: all of the above are implemented as server-rendered pages with client components for
interaction. Authentication is not built yet; the app resolves a single viewer from the
`profiles` table, so the RLS policies in the initial migration are not yet exercised by a
real session.

---

### Supabase

Responsibilities:

* Authentication
* Database
* Row level security
* Storage if required
* Server functions if required

---

### Job Ingestion Layer

Responsibilities:

* Fetch jobs
* Normalize jobs
* Validate jobs
* Detect duplicates
* Save jobs

---

### AI Layer

Responsibilities:

* Classification
* Summarization
* Skill extraction
* Job matching
* Gap detection

---

## Processing Pipeline

```text
FETCH
 ↓
VALIDATE
 ↓
NORMALIZE
 ↓
DEDUPLICATE
 ↓
STORE
 ↓
CLASSIFY
 ↓
MATCH
 ↓
NOTIFY
```

---

## Scheduling

The ingestion system should run automatically.

Not implemented yet. All three endpoints are idempotent and already accept the shared secret
(`Authorization: Bearer <CRON_SECRET>`, or `x-cron-secret`), so they are ready to be called
from a scheduler. In production a missing `CRON_SECRET` denies every request rather than
opening the routes.

Initial target:

Every 6–12 hours.

Later:

Configurable schedules per source.

---

## Scalability

The architecture should support moving from:

10 companies

to:

100 companies

to:

1,000+ companies

without rewriting the entire system.
