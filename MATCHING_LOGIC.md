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
