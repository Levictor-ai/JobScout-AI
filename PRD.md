# JobScout AI

## Product Requirements Document

### 1. Product Overview

JobScout AI is a personal AI powered job discovery and filtering platform.

The system automatically monitors public job sources and company career pages, collects newly published jobs, removes duplicates, analyzes job descriptions, compares opportunities against the user's professional profile, and presents the most relevant opportunities in a centralized dashboard.

The initial product is designed for personal use but should be architected so it can eventually become a multi user SaaS product.

---

## 2. Problem

Job seekers currently spend significant amounts of time:

* Searching multiple job boards.
* Visiting individual company career pages.
* Repeating the same searches.
* Reading hundreds of job descriptions.
* Determining whether they actually qualify.
* Tracking jobs they have already seen.
* Remembering which applications they have submitted.

The goal is to automate the discovery and filtering process while keeping the final application decision with the user.

---

## 3. Product Goal

Build an automated job discovery assistant that answers:

> "What relevant jobs were posted recently that I should consider applying for?"

The system should prioritize relevance over volume.

---

## 4. Target User

### Primary user

A designer/technology professional looking for:

* Product Designer roles
* UX/UI Designer roles
* Brand Designer roles
* Graphic Designer roles
* Web Designer roles
* Design Engineer roles
* Product Engineer roles
* AI related design/product roles

### Geographic preferences

The system should support:

* Remote
* Nigeria
* United Kingdom
* Canada
* United States
* Europe
* Other international locations

Location preferences must be configurable.

---

## 5. Core Features

### 5.1 Job Source Management

Users can configure companies and sources to monitor.

Supported sources should initially include:

* Greenhouse
* Lever
* Ashby
* Public company career pages where technically and legally appropriate

Each source should have:

* Source name
* Company
* URL
* Source type
* Active/inactive state
* Last checked timestamp

---

### 5.2 Automated Job Collection

The system should periodically check configured sources.

For each job:

* Extract title
* Company
* Location
* Remote status
* Employment type
* Salary if available
* Description
* Requirements
* Posted date
* Application URL
* Source
* Source job ID

---

### 5.3 Duplicate Detection

The system must prevent the same job from appearing multiple times.

Use combinations of:

* Source
* Source job ID
* Company
* Job URL
* Normalized title

---

### 5.4 Job Classification

AI should classify each job into categories such as:

* Product Design
* UX/UI
* Brand Design
* Graphic Design
* Web Design
* Design Engineering
* Product Engineering
* Other

It should also identify seniority:

* Internship
* Entry level
* Junior
* Mid level
* Senior
* Lead
* Principal
* Director
* Unknown

---

### 5.5 AI Job Matching

Every collected job should be compared against the user's profile.

The system should consider:

* Skills
* Experience
* Seniority
* Location
* Remote eligibility
* Industry
* Tools
* Portfolio relevance
* Job responsibilities
* Required qualifications
* Nice to have qualifications

The system should produce:

* Match percentage
* Matching factors
* Potential gaps
* Recommended action

Example:

MATCH: 89%

Strong matches:

* Product design
* Figma
* Design systems
* MVP experience
* Remote work

Potential gaps:

* 5+ years SaaS experience requested

---

### 5.6 Dashboard

The dashboard should display:

* New jobs
* High match jobs
* Saved jobs
* Applied jobs
* Interview jobs
* Rejected jobs
* Archived jobs

Users should be able to filter by:

* Role
* Company
* Location
* Remote status
* Match
* Seniority
* Source
* Date posted
* Application status

---

### 5.7 Job Details

Each job should have a detailed view containing:

* Job title
* Company
* Location
* Salary
* Remote status
* Posted date
* Full description
* Requirements
* AI summary
* Match analysis
* Skills matched
* Skills missing
* Application URL

Primary actions:

* Apply
* Save
* Ignore
* Mark as Applied
* Archive

---

### 5.8 Application Tracking

Users should be able to track:

* Discovered
* Saved
* Applying
* Applied
* Assessment
* Interview
* Offer
* Rejected
* Withdrawn
* Archived

The system should never automatically submit an application without explicit user action.

---

### 5.9 Notifications

The system should eventually support:

* Daily email digest
* New high match notification
* Weekly summary

Example:

> 7 new jobs match your profile today.
>
> 3 have a match above 85%.

---

## 6. AI Requirements

AI should:

1. Summarize jobs.
2. Categorize jobs.
3. Determine seniority.
4. Extract requirements.
5. Extract skills.
6. Compare jobs against the user's profile.
7. Explain matches.
8. Explain gaps.
9. Identify potential application concerns.
10. Generate concise recommendations.

AI must not fabricate requirements, salary information, company information, or job details.

If information is unavailable, return:

"Not specified."

---

## 7. Non Goals

The first version should NOT:

* Automatically submit applications.
* Bypass CAPTCHAs.
* Bypass authentication.
* Scrape private job boards.
* Circumvent anti bot systems.
* Automatically create accounts on third party websites.
* Misrepresent the user.
* Apply to jobs without explicit user action.

---

## 8. MVP

The first version should include:

1. Supabase database.
2. User profile.
3. Company/source management.
4. Greenhouse integration.
5. Lever integration.
6. Ashby integration.
7. Job ingestion.
8. Duplicate detection.
9. AI classification.
10. AI matching.
11. Dashboard.
12. Job detail page.
13. Save/ignore functionality.
14. Application tracking.
15. Basic scheduled scanning.

---

## 9. Success Criteria

The MVP is successful when it can:

* Monitor configured companies.
* Detect newly published jobs.
* Store jobs reliably.
* Avoid duplicates.
* Identify relevant design/product jobs.
* explain why a job matches the user's profile.
* Allow the user to save and track opportunities.
* Provide direct links to the original application page.
