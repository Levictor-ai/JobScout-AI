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
* created_at
* updated_at

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
