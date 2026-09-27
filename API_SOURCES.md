# JobScout AI API Sources

## Verified Endpoints

Each endpoint below was called and confirmed working. No authentication.

### Greenhouse

```text
GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
```

Response: `{ jobs: [...] }`

Fields used:

* `id`
* `title`
* `content` (HTML description)
* `location.name`
* `departments[].name`
* `absolute_url`
* `first_published`
* `updated_at`

Notes:

* There is no pagination. Large boards return 5–9 MB in a single response.
* The public board API does not expose salary.

---

### Ashby

```text
GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true
```

Response: `{ jobs: [...] }`

Fields used:

* `id`
* `title`
* `descriptionPlain` (falls back to `descriptionHtml`)
* `location`, `secondaryLocations[].location`
* `department`, `team`
* `employmentType`
* `isRemote`, `workplaceType`
* `isListed` (unlisted postings are skipped)
* `publishedAt`
* `jobUrl`, `applyUrl`
* `compensation.summaryComponents[]`, `compensation.compensationTiers[].components[]`

---

### Lever

Status: unusable at the time of writing.

```text
GET https://api.lever.co/v0/postings/{site}?mode=json
```

The endpoint answered `404` for every board tested, including Lever's own demo
board and both the global and EU hosts. Lever-hosted pages
(`https://jobs.lever.co/{site}`) still render, but there is no reachable public
JSON API to read.

The authenticated Lever API (`https://api.lever.co/v1`) requires an account API
key, so it cannot be used for third-party monitoring.

Lever is therefore excluded from ingestion until a public endpoint is verified
again. No HTML scraping is used as a substitute.

---

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

Reserved for a future release. See the status note above.

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
  endpoint(config: SourceConfig): string
  careersUrl(config: SourceConfig): string
  fetchJobs(config: SourceConfig): Promise<NormalizedJob[]>
}
```

This allows new sources to be added without rewriting the ingestion system.

Implemented in `src/lib/sources/`. A new source means adding one adapter file and
registering it in `src/lib/sources/index.ts`.

---

## Important Rule

Never assume an undocumented API exists.

Before implementing a source:

1. Verify the official documentation.
2. Verify whether authentication is required.
3. Verify rate limits.
4. Verify permitted use.
5. Implement an adapter.
