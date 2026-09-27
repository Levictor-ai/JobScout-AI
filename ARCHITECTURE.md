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
