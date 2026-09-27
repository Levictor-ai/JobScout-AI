# JobScout AI API Sources

## Primary Sources

### Greenhouse

Use the public Greenhouse Job Board API where available.

Purpose:

Retrieve published jobs from companies using Greenhouse.

Required information:

* Company identifier
* Job board URL
* Published jobs

Do not assume every company uses the same configuration.

---

## Lever

Use the public Lever postings interface where available.

Purpose:

Retrieve published jobs.

Required information:

* Company identifier
* Published job listings

---

## Ashby

Use the public Ashby job posting interface where available.

Purpose:

Retrieve currently published positions.

Required information:

* Company identifier
* Public job board

---

## Future Sources

Potential future integrations:

* Workday
* SmartRecruiters
* Teamtailor
* BambooHR
* Recruitee
* Company specific career pages

Only implement additional sources when there is a clear technical and legal basis.

---

## Source Adapter Architecture

Each source should implement a common interface.

Example conceptual interface:

```typescript
interface JobSourceAdapter {
  fetchJobs(source: JobSource): Promise<RawJob[]>
  normalizeJob(job: RawJob): NormalizedJob
}
```

This allows new sources to be added without rewriting the ingestion system.

---

## Important Rule

Never assume an undocumented API exists.

Before implementing a source:

1. Verify the official documentation.
2. Verify whether authentication is required.
3. Verify rate limits.
4. Verify permitted use.
5. Implement an adapter.
