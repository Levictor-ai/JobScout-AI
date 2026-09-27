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

Read `PROMPT.md` and `AGENT.md` before making major changes.

Build incrementally.

Do not attempt to implement the entire roadmap in a single step.
