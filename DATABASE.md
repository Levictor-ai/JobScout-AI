# JobScout AI Database

## users

Stores application users.

Fields:

* id
* email
* created_at
* updated_at

---

## profiles

Stores professional profiles.

Fields:

* id
* user_id
* name
* headline
* summary
* years_experience
* location
* portfolio_url
* linkedin_url
* resume_text
* preferences
* created_at
* updated_at

---

## skills

Stores user skills.

Fields:

* id
* profile_id
* name
* category
* proficiency

---

## companies

Stores monitored companies.

Fields:

* id
* name
* website
* careers_url
* ats_type
* ats_identifier
* active
* created_at
* updated_at

---

## sources

Stores job sources.

Fields:

* id
* company_id
* source_type
* source_url
* active
* last_checked_at
* last_success_at
* last_error
* created_at
* updated_at

---

## jobs

Stores normalized job listings.

Fields:

* id
* company_id
* source_id
* external_id
* title
* description
* location
* remote_status
* employment_type
* seniority
* salary_min
* salary_max
* salary_currency
* posted_at
* application_url
* source_url
* raw_data
* role_category
* dedupe_key
* content_hash
* last_seen_at
* created_at
* updated_at

Notes:

* `role_category` is set by the normalizer (product_design, ux_ui, brand_design,
  graphic_design, web_design, design_engineering, product_engineering, research, other).
* `dedupe_key` is company + normalized title + team + location + employment type.
* `content_hash` changes only when the job content actually changed, so repeat
  scans do not create update churn.
* `last_seen_at` is refreshed on every scan where the posting is still listed.

---

## job_skills

Fields:

* id
* job_id
* skill
* required
* confidence

---

## job_matches

Stores AI matching results.

Fields:

* id
* job_id
* profile_id
* match_score
* summary
* matching_factors
* skill_gaps
* concerns
* recommendation
* model
* created_at

---

## saved_jobs

Fields:

* id
* user_id
* job_id
* created_at

---

## applications

Fields:

* id
* user_id
* job_id
* status
* applied_at
* notes
* updated_at

Statuses:

* discovered
* saved
* applying
* applied
* assessment
* interview
* offer
* rejected
* withdrawn
* archived

---

## scan_logs

Fields:

* id
* source_id
* started_at
* completed_at
* jobs_found
* jobs_new
* jobs_updated
* error
* status

---

## notification_log

Records what was already sent so the same job is never notified twice.

Fields:

* id
* channel
* job_id
* match_score
* telegram_message_id
* status
* error
* sent_at

Unique on:

* channel + job_id

---

## How the app talks to this schema

Reads go through `src/lib/data/queries.ts` and writes through `src/lib/actions/`. Both use
the Supabase service-role client, which bypasses row level security.

`user_id` is a real `auth.users` foreign key, but Supabase Auth is not built yet, so
`getViewerId()` resolves the viewer by either `SUPABASE_USER_ID` or the first row in
`profiles`. That means:

* Every saved job, application, and match is attributed to the same account.
* Setting `SUPABASE_USER_ID` to a UUID that does not exist in `auth.users` will fail the
  foreign key, and the actions will return the error rather than a false success.
* This is a single-user deployment. Multi-user support requires Supabase Auth plus reading
  the session in the server components and actions, and nothing else in the data layer has
  to change.

`discovered` is the default application status and is treated as "not tracked yet": the
Applications page filters it out, and setting a role back to `Discovered` in the job modal
deletes the tracking row instead of upserting a tracked one. Un-saving a role does the same.

