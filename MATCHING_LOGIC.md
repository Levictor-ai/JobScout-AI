# Job Matching Logic

## Objective

Determine how relevant a job is to the user's profile.

The match should be explainable.

Do not rely solely on a single opaque AI score.

---

## Matching Factors

### Role relevance

Does the job correspond to the user's target roles?

Weight: High

---

### Skills

Compare:

* Required skills
* Preferred skills
* User skills

Weight: High

---

### Experience

Compare:

* Required years
* User experience
* Seniority

Weight: High

---

### Location

Consider:

* Remote
* User location
* Geographic restrictions

Weight: High

---

### Portfolio relevance

Determine whether the user's portfolio contains relevant work.

Weight: Medium

---

### Industry relevance

Compare industry experience.

Weight: Low/Medium

---

## AI Output

The AI should return structured JSON.

Example:

```json
{
  "match_score": 88,
  "role_relevance": "high",
  "matching_factors": [
    "Product design experience",
    "Figma",
    "Design systems",
    "MVP design"
  ],
  "skill_gaps": [
    "Advanced accessibility experience"
  ],
  "concerns": [],
  "recommendation": "high_priority"
}
```

---

## Important

The AI must explain the score.

Do not display:

"88% match"

without providing the underlying factors.

The user must be able to understand why the job was considered relevant.

---

## Match Categories

Instead of treating the score as absolute truth:

90â€“100:
Very strong alignment

75â€“89:
Strong alignment

60â€“74:
Potential alignment

Below 60:
Low alignment

These categories are informational filters, not guarantees of hiring success.

---

## Implemented Behaviour

* Two model calls per role. One classifies and extracts skills from the posting; one scores the
  classified role against the profile and explains the score. Both are strict JSON schema
  calls with `temperature: 0`.
* Candidate screening happens before the model. Roles are filtered by posted date, target
  role/seniority, and `remote_only`, so tokens are not spent on roles that cannot match.
* `job_matches` is upserted on `(job_id, profile_id)`, so re-scoring a role replaces the
  previous verdict instead of accumulating history.
* `pendingOnly` (default `true` in `run` mode) skips any job whose newest match is at least
  as recent as the job row. The job row's `updated_at` changes on every re-ingest, so a
  reposted or edited description is re-scored automatically while untouched roles are not.
* The UI never shows a bare percentage. The score bar is always accompanied by
  `matching_factors`, `skill_gaps`, any `concerns`, the summary, and the model name and
  timestamp. Roles with no stored match show no score at all rather than a guess.
* Match scores gate the Telegram digest through a threshold; they never trigger an
  application.
