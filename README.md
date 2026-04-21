# FiskGrad

FiskGrad is an academic planning system for Fisk University students. It connects transcript history, degree requirements, course planning, section selection, calendar export, course reviews, professor ratings, GPA projection, AI advising, and advisor-ready balance sheets into a single workflow.

The purpose is simple: a student should be able to understand where they are, what they still need, and how to finish — without jumping between a transcript PDF, a catalog page, a balance sheet, registration tools, advisor notes, and a spreadsheet.

---

## Vision

FiskGrad is designed to become the ultimate academic operating system for Fisk University students — part degree planner, part Rate My Professor, part academic advisor.

A student should be able to:

- sign in with a Fisk student email
- upload an unofficial transcript to pre-fill completed courses
- explore all available majors and see which ones best match their completed coursework
- choose or confirm a major (or stay undeclared and explore)
- see completed, in-progress, planned, and missing requirements
- preview how their current courses map against any major before committing ("What if I switched to Biology?")
- understand the impact of changing their major before saving it
- build a semester-by-semester path to graduation
- choose real course sections and detect schedule conflicts
- export a schedule calendar
- project their GPA based on planned courses and expected grades
- read and write structured course reviews with difficulty, quality, and would-take-again ratings
- look up professor profiles with aggregated ratings and course history
- generate an advisor-ready degree audit or balance sheet
- get AI-assisted planning support without making AI the authority

The core academic logic remains deterministic and auditable. AI can explain, suggest, and help students ask better questions — but requirement satisfaction, transcript parsing, plan storage, and degree-audit outputs are driven by transparent rules and source data.

---

## Why This Exists

Degree planning is fragmented. Students often have to combine:

- unofficial transcript PDFs
- major balance sheets
- catalog requirements
- prerequisite rules
- advisor notes
- registration sections
- calendar conflicts
- transfer-credit history
- personal spreadsheets

FiskGrad reduces those gaps. The system helps students and advisors work from the same picture: what is done, what is planned, what remains, and what needs review.

---

## Product Scope

| Area | What it does |
|---|---|
| **Authentication** | Restricts access to Fisk student emails (`@my.fisk.edu`). |
| **Dashboard** | Quick view of progress, plan status, transcript import, and next actions. |
| **Onboarding** | Collects major, timeline, and completed courses; supports transcript upload and manual search. |
| **Transcript Import** | Parses unofficial transcript PDFs (including AES-encrypted Fisk exports) into completed and in-progress courses. |
| **Planner** | Semester-by-semester course planning with drag/drop, warnings, credits, GPA, and section selection. |
| **Requirements** | Tracks major requirements against the active plan; includes What-if major preview. |
| **Explore Majors** | Lists all Fisk majors ranked by compatibility with completed courses; preview requirements and declare from one page. |
| **GPA Calculator** | Projects cumulative GPA based on current standing and expected grades for planned courses. |
| **Balance Sheet** | Advisor-facing degree-audit views from supported major templates and student plan data. |
| **Custom Sheet Upload** | Upload a local PDF or Word balance sheet alongside planning work. |
| **Courses** | Catalog browsing, full-text search, filters, and section detail. |
| **Calendar** | Turns selected sections into a weekly schedule with conflict detection and `.ics` export. |
| **Hub — Reviews** | Structured course reviews with quality rating, difficulty rating, would-take-again, and tags. |
| **Hub — Professors** | Professor profiles aggregated from reviews: avg quality, avg difficulty, would-take-again %, courses taught. |
| **Hub — AI Advisor** | Streaming AI planning support contextualised to the student's plan, major, and requirements. |
| **Profile** | Avatar upload, major/minor combobox search, major-change impact preview, plan export, account deletion. |

---

## Supported Balance-Sheet Templates

The balance-sheet system supports 14 templates:

| Code | Program |
|---|---|
| `ACC` | Accounting |
| `BAD-NON` | Business Administration, Non-Concentration |
| `BIS-AS` | Business Information Systems A.S. |
| `BMB` | Biochemistry and Molecular Biology |
| `CSCI` | Computer Science |
| `CSCI-JOINT` | Computer Science Joint Major |
| `CRJ` | Criminal Justice |
| `FIN-ECON` | Finance/Economics |
| `MGT` | Management |
| `MKT` | Marketing |
| `MATH` | Mathematics B.A. |
| `MUSIC-BIZ` | Music Business |
| `PHYS` | Physics |
| `SOC-JOINT` | Sociology Joint Major |

Template JSON source files live in `web/data/` (frontend) and `data/` (source workspace).

---

## Requirement Logic

Requirement groups can be satisfied by:

- specific required courses (`all_of`)
- course choices (`choose_one`, `choose_n`)
- credit thresholds (`credit_threshold`)
- rule-based elective buckets by subject and level range (`subject_level`)

Key files: `web/lib/requirements.ts`, `Backend/app/db.py`

---

## Architecture

```text
shared academic data → feature engines → thin UI layers
```

Key frontend modules:

| File | Responsibility |
|---|---|
| `web/lib/api.ts` | API client and all backend-facing types. |
| `web/lib/requirements.ts` | Requirement progress and satisfaction logic. |
| `web/lib/balance-sheet.ts` | Balance-sheet view-model builder. |
| `web/lib/calendar.ts` | Calendar and `.ics` generation. |
| `web/lib/nav.ts` | Navigation source of truth. |
| `web/contexts/plan-context.tsx` | Global plan, majors, labels, and profile state. |
| `web/contexts/auth-context.tsx` | Supabase auth state. |

---

## Repo Layout

```text
fiskgrad/
  Backend/                  FastAPI backend
  Backend/app/              API, auth, DB, transcript parser, AI advisor
  Backend/scripts/          SQL migrations, seed scripts, deployment helpers
  data/                     source templates, balance sheets, transcript samples
  web/                      Next.js frontend (App Router)
  web/app/                  Pages and layouts
  web/components/           Product and UI components
  web/contexts/             Auth and plan providers
  web/data/                 Balance-sheet template JSON
  web/lib/                  Feature engines, API client, utility logic
  web/public/               Static assets
```

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | FastAPI, Python 3.11 |
| Database | Supabase Postgres (via pgbouncer pooler) |
| Auth | Supabase Auth (JWT, `@my.fisk.edu` enforcement) |
| AI | OpenRouter (OpenAI-compatible client) |
| Transcript Parsing | pypdf + cryptography (AES-encrypted PDF support) |
| Calendar Export | Frontend-generated `.ics` files |
| Deployment | Vercel (frontend), Render (backend) |

---

## Backend API

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | — | Health check. |
| `GET` | `/api/subjects` | — | Course subject codes. |
| `GET` | `/api/majors` | — | All degree programs including UNDECLARED. |
| `GET` | `/api/majors/compatibility` | — | Match student course codes against each major's required courses. |
| `GET` | `/api/courses` | — | Courses by subject. |
| `GET` | `/api/courses/search` | — | Full-text catalog search. |
| `GET` | `/api/sections` | — | Sections for given course codes and term. |
| `GET` | `/api/course-labels` | — | Requirement labels and elective rules for a major. |
| `GET` | `/api/terms` | — | Term calendar. |
| `GET/PUT` | `/api/profile` | ✓ | Student profile. |
| `GET/PUT` | `/api/plan` | ✓ | Saved academic plan. |
| `POST` | `/api/transcript` | ✓ | Parse unofficial transcript PDF. |
| `GET` | `/api/reviews` | — | Reviews for a course code. |
| `GET` | `/api/reviews/recent` | — | Recent review feed. |
| `POST` | `/api/reviews` | ✓ | Submit a review (with quality, difficulty, would-take-again, tags). |
| `GET` | `/api/professors` | — | Aggregated professor stats from reviews. |
| `GET` | `/api/professors/reviews` | — | All reviews for a specific professor. |
| `POST` | `/api/ai/advise` | ✓ | Streaming AI advisor response. |
| `POST` | `/api/balance-sheet/scan` | ✓ | Scan PDF/DOCX balance sheet. |
| `POST` | `/api/balance-sheet/fill-docx` | ✓ | Fill DOCX balance sheet template. |
| `DELETE` | `/api/account` | ✓ | Delete account and all plan data. |

---

## Database Seeding

Run these in order in the **Supabase SQL Editor**:

### 1. Schema (run once at setup)
```text
Backend/scripts/complete_requirements_setup.sql
```
Creates all tables and seeds the CS major with full requirements.

### 2. All Fisk Majors
```text
Backend/scripts/seed_all_majors.sql
```
Adds all 31 Fisk University degree programs to the `majors` table. Required for the major search and Explore Majors page to show anything beyond CS.

### 3. Structured Review Fields
```text
Backend/scripts/reviews_structured_fields.sql
```
Adds `difficulty`, `quality`, `would_take_again`, and `tags` columns to `course_reviews`. Required for the new rating fields and professor aggregation to work.

### 4. Security Hardening (production only)
```text
Backend/scripts/security_hardening.sql
```
Adds Supabase-side email enforcement, row-level security policies, and storage policies. Review against the actual schema before applying.

---

## Security Model

- Frontend and backend both reject emails outside `@my.fisk.edu`.
- Supabase hardening SQL enforces the domain at the database/auth layer.
- JWT validation requires signed Supabase tokens.
- IP-based rate limits on transcript, AI, reviews, and balance-sheet endpoints.
- Per-user AI rate limit: 20 messages per 15 minutes.
- Transcript PDFs are parsed in memory and never stored.
- Profile image uploads are limited by MIME type and size.
- Review inputs are validated; course codes are normalised; tags are allowlisted server-side.
- Security headers set by the backend on all responses.

---

## Privacy

- Do not expose service-role keys to the frontend.
- Do not store transcript files.
- Do not use AI responses as official degree audits.
- Course reviews are anonymous — no user ID is stored or returned.
- Keep advisor-facing exports clearly labelled as student-generated, not official university records.

---

## Local Development

**Frontend:**
```bash
npm --prefix web install
npm --prefix web run dev
```

**Backend:**
```bash
cd Backend
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## Environment Variables

This project requires separate frontend and backend environment configuration for local development and deployment.

- Keep all secrets in local `.env` files or your hosting provider's secret manager.
- Do not commit API keys, service-role credentials, JWT secrets, database URLs, or production callback URLs.
- Use the checked-in example env files as the source of truth for required keys:
  - `web/.env.example`
  - `Backend/.env.example`

---

## Deployment

### Vercel (frontend)

| Setting | Value |
|---|---|
| Root directory | `web` |
| Build command | `npm run build` |

### Render (backend)

| Setting | Value |
|---|---|
| Root directory | `Backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

Deployment-specific secrets, callback URLs, and redirect URLs should be configured privately in your hosting dashboards, not documented here.

---

## Validation

```bash
# Backend syntax check
python -m py_compile Backend/app/auth.py Backend/app/main.py Backend/app/db.py

# Frontend type check
npx --prefix web tsc --noEmit

# Frontend production build
npm --prefix web run build
```

---

## Current Status

FiskGrad is a feature-rich beta. All major product flows are implemented and working end-to-end.

**What is fully working:**
- Fisk-only student access (frontend + backend + Supabase hardening)
- Unofficial transcript PDF import (AES-encrypted Fisk exports supported)
- Full onboarding flow with transcript upload and manual course search
- Semester-by-semester drag-drop planner
- Course catalog search with full-text and filters
- Section picker with conflict detection
- Calendar export (weekly view + `.ics`)
- Requirements tracking (required, group choice, electives, general)
- What-if major preview on the requirements page
- Explore Majors page with compatibility scoring and inline preview
- Undeclared student path with major exploration and declare flow
- Major change impact preview on the profile page
- GPA calculator (current standing + planned courses + expected grades)
- Structured course reviews (quality, difficulty, would-take-again, tags)
- Professor ratings aggregated from reviews (Hub → Professors tab)
- AI advisor (streaming, context-aware)
- Balance sheet (system-generated + custom PDF/DOCX upload)
- Profile management (avatar, major/minor search, graduation target)
- PDF plan export
- Account deletion
- Cross-browser compatibility (Chrome, Safari, Brave, Firefox — OKLCH color fallbacks)

**Pending before full production:**

| Item | Priority | Notes |
|---|---|---|
| Run `seed_all_majors.sql` in Supabase | **Critical** | Without it, only CS appears in major search |
| Run `reviews_structured_fields.sql` in Supabase | **Critical** | Without it, review ratings will fail to save |
| Set `ALLOWED_ORIGINS` on Render | **Critical** | Without it, Vercel can't call the API (CORS block) |
| Set `NEXT_PUBLIC_API_BASE_URL` on Vercel | **Critical** | Without it, the deployed frontend calls localhost |
| Set Supabase redirect URLs | **High** | Without it, email verification links don't work |
| Run `security_hardening.sql` in Supabase | **High** | Adds RLS, storage policies, and auth-layer email enforcement |
| Seed requirements for non-CS majors | **Medium** | Requirements page is empty for all majors except CS |
| Test real Fisk student signup/login flows | **Medium** | Verify `@my.fisk.edu` domain works end-to-end |
| Test transcript import with real student PDFs | **Medium** | Verify parser handles all Fisk transcript formats |
| Section availability alerts | **Low** | Notify when a closed section gets a seat (not built) |
| Schedule optimizer | **Low** | "Build me a schedule with no Friday classes" (not built) |
| Corequisite warnings | **Low** | Schema supports it, UI logic not built |
| End-to-end tests | **Low** | No automated tests exist yet |

---

## Product Direction

The strongest wedge is not generic AI advising. It is accurate, student-owned degree progress:

- transcript-aware
- major-aware
- advisor-readable
- schedule-aware
- secure enough for student academic records

If FiskGrad becomes the place where students can reliably answer *"what do I need to graduate and what should I take next?"*, it can expand into advisor dashboards, department analytics, official degree-audit integrations, transfer evaluation support, and registration planning.

**The core principle:** FiskGrad helps students understand and prepare. Official academic decisions still belong to Fisk University advisors, departments, and the registrar.
