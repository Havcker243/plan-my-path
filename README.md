# FiskGrad

FiskGrad is an academic planning system for Fisk students. It connects transcript history, degree requirements, course planning, section selection, calendar export, course reviews, AI advising support, and advisor-ready balance sheets into one workflow.

The purpose is simple: a student should be able to understand where they are, what they still need, and how to finish without having to jump between a transcript PDF, a catalog page, a balance sheet, registration tools, advisor notes, and a spreadsheet.

## Vision

FiskGrad is designed to become a student-owned degree planning workspace for Fisk University students.

The long-term vision is bigger than a prettier planner. FiskGrad should become a practical academic operating system where a student can:

- sign in with a Fisk student email
- upload an unofficial transcript
- choose or confirm a major
- see completed, in-progress, planned, and missing requirements
- build a semester-by-semester path to graduation
- choose real course sections
- export a schedule calendar
- generate an advisor-ready degree audit or balance sheet
- get AI-assisted planning explanations without making AI the authority

The core academic logic should remain deterministic and auditable. AI can explain, suggest, and help students ask better questions, but requirement satisfaction, transcript parsing, plan storage, balance-sheet progress, and degree-audit outputs should be driven by transparent rules and source data.

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

That fragmentation causes real problems:

- completed courses may not be counted in the right requirement group
- in-progress courses may be ignored because they do not have final grades yet
- elective buckets may be treated incorrectly when only a certain number of credits are required
- transfer credits may be hard to place
- students may not know which courses count toward their major
- advisors may not receive a clean, printable view of the student's plan
- students may make registration decisions from incomplete information

FiskGrad exists to reduce those gaps. The system should help students and advisors work from the same picture: what is done, what is planned, what remains, and what needs review.

## Product Scope

FiskGrad currently includes these major product areas.

| Area | What it does |
|---|---|
| Authentication | Restricts access to Fisk student emails ending in `@my.fisk.edu`. |
| Dashboard | Gives students a quick view of progress, plan status, transcript import, and next actions. |
| Onboarding | Collects major, start term, graduation target, and completed course information. |
| Transcript Import | Parses unofficial transcript PDFs into completed and in-progress courses. |
| Planner | Provides semester-by-semester course planning with add, remove, drag/drop, warnings, credits, GPA, and section selection. |
| Requirements | Tracks major requirements using the active plan and template data. |
| Balance Sheet | Builds advisor-facing degree-audit views from supported major templates and student plan data. |
| Custom Sheet Upload | Allows students to preview a local PDF, Word document, or image balance sheet alongside their planning work. |
| Courses | Provides catalog browsing, course search, sections, and course detail views. |
| Calendar | Turns selected sections into a weekly schedule and `.ics` export. |
| Reviews | Lets students create and browse course reviews with backend validation and rate limits. |
| AI Advisor | Offers optional AI planning support through the backend when configured. |
| Profile | Supports account profile, avatar upload, plan export, and account deletion. |

## Supported Balance-Sheet Templates

The balance-sheet system now supports 14 templates:

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

Template JSON source files live in both:

- `data/`
- `web/data/`

This duplication is intentional for now. The frontend is rooted in `web`, so the Next.js app imports template JSON from `web/data`. The root `data` directory remains the source workspace for transcript samples, extracted balance sheets, and template-building artifacts.

## Requirement Logic

FiskGrad now handles more than fixed course checklists. Requirement groups can be satisfied by:

- specific required courses
- course choices
- credit thresholds
- a required number of courses
- rule-based buckets such as approved electives

This matters for degree audits and balance sheets. Some Fisk balance sheets list a group of possible courses where the student only needs a certain number of credits before the group is fulfilled. FiskGrad tracks those groups by progress toward the required credits instead of incorrectly requiring every course in the list.

Important implementation files:

- `web/lib/requirements.ts`
- `web/lib/balance-sheet.ts`
- `web/lib/balance-sheet-templates.ts`
- `Backend/app/db.py`

## Architecture

The project follows this structure:

```text
shared academic data -> feature engines -> thin UI layers
```

Shared data includes:

- authenticated user profile
- saved academic plan
- plan semesters and courses
- course catalog
- course sections
- major requirement labels
- balance-sheet templates
- transcript parse results

Feature engines live mainly in `web/lib/*`. They should transform data without depending on React UI state.

Important frontend modules:

| File | Responsibility |
|---|---|
| `web/lib/api.ts` | API client and backend-facing types. |
| `web/lib/api-adapters.ts` | Backend-to-frontend data adapters. |
| `web/lib/plan-state.ts` | Pure plan state and save payload helpers. |
| `web/lib/course-utils.ts` | Course-code, term, and label utilities. |
| `web/lib/transcript.ts` | Frontend transcript and onboarding helpers. |
| `web/lib/planner.ts` | Planner-specific helpers. |
| `web/lib/requirements.ts` | Requirement progress and satisfaction logic. |
| `web/lib/balance-sheet.ts` | Balance-sheet view-model builder. |
| `web/lib/balance-sheet-templates.ts` | Supported template registry. |
| `web/lib/calendar.ts` | Calendar and `.ics` generation helpers. |
| `web/lib/email-access.ts` | Allowed Fisk student email-domain checks. |
| `web/lib/nav.ts` | Navigation source of truth. |

Architecture notes live in:

- `docs/architecture/README.md`

## Repo Layout

```text
fiskgrad/
  Backend/                  FastAPI backend
  Backend/app/              API, auth, DB, transcript parser, AI advisor
  Backend/scripts/          SQL, sync, seed, and deployment helper scripts
  data/                     source templates, balance sheets, transcript samples
  docs/architecture/        architecture guidance
  web/                      Next.js frontend
  web/app/                  App Router pages and layouts
  web/components/           product and UI components
  web/contexts/             auth and plan providers
  web/data/                 frontend balance-sheet template JSON
  web/lib/                  feature engines, API client, utility logic
  web/public/               static assets and optional PDF templates
```

The intended GitHub repository and deployed product name is `fiskgrad`. The current local folder may still be named `plan-my-path` if the directory could not be renamed while files were open.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Framer Motion |
| Backend | FastAPI, Python |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| AI | OpenRouter through the OpenAI-compatible backend client |
| Transcript Parsing | Python PDF parsing |
| Calendar Export | Frontend-generated `.ics` files |
| Deployment | Vercel frontend, Render backend |

## Backend API

Key endpoints:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Backend health check. |
| `GET` | `/api/subjects` | Course subject acronyms. |
| `GET` | `/api/majors` | Degree programs. |
| `GET` | `/api/courses` | Courses by subject. |
| `GET` | `/api/courses/search` | Catalog search. |
| `GET` | `/api/sections` | Sections for course codes. |
| `GET` | `/api/course-labels` | Requirement labels and elective rules for a major. |
| `GET/PUT` | `/api/profile` | Student profile. |
| `GET/PUT` | `/api/plan` | Saved academic plan. |
| `POST` | `/api/transcript` | Parse an authenticated student's transcript PDF. |
| `GET/POST` | `/api/reviews` | Course reviews. |
| `GET` | `/api/reviews/recent` | Recent review feed. |
| `POST` | `/api/ai/advise` | AI advisor response. |
| `DELETE` | `/api/account` | Account and plan deletion. |

## Security Model

FiskGrad handles student academic information, so security is part of the core product and not a later add-on.

Current protections:

- Frontend sign-up and login reject emails outside `@my.fisk.edu`.
- Backend authenticated routes also reject non-Fisk student emails.
- Supabase hardening SQL includes an Auth trigger to enforce `@my.fisk.edu` at the database/auth layer.
- Backend JWT validation requires signed Supabase tokens and no longer falls back to unsafe unsigned decoding.
- Sensitive routes have basic IP-based rate limits.
- Transcript uploads require authentication.
- Transcript uploads are limited to PDF, checked by filename, content type, size, and PDF magic bytes.
- Profile image uploads are limited by MIME type and size.
- Review inputs are validated and course codes are normalized.
- AI advisor request size and history length are capped.
- Security headers are added by the backend.
- Service-role Supabase credentials are intended for backend use only.
- Transcript PDFs are parsed in memory and are not stored by the transcript endpoint.

Important files:

- `web/lib/email-access.ts`
- `web/contexts/auth-context.tsx`
- `web/app/(auth)/login/page.tsx`
- `web/app/(auth)/signup/page.tsx`
- `web/components/app-layout.tsx`
- `Backend/app/auth.py`
- `Backend/app/main.py`
- `Backend/scripts/security_hardening.sql`

Before production, run and verify the SQL in:

```text
Backend/scripts/security_hardening.sql
```

That script adds Supabase-side email enforcement, row-level security policies, and storage policies. Review it against the actual Supabase schema before applying it to production.

## Privacy Direction

FiskGrad should minimize how much student data it stores and make stored data easy to explain.

Current data categories include:

- student account email
- student profile details
- major and graduation target
- saved academic plan
- completed and planned courses
- selected sections
- course reviews
- optional profile avatar

Important privacy expectations:

- Do not expose service-role keys to the frontend.
- Do not store transcript files unless the product explicitly adds secure transcript storage later.
- Do not use AI responses as official degree audits.
- Keep advisor-facing exports clear that students must verify final requirements with Fisk advisors or official university records.
- Avoid logging sensitive transcript contents in production.

## Local Development

Install frontend dependencies:

```bash
npm --prefix web install
```

Run the frontend:

```bash
npm --prefix web run dev
```

Create and activate a backend environment on Windows:

```bash
cd Backend
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The root package also proxies common frontend commands:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Environment Variables

Frontend environment, usually `web/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=my.fisk.edu
```

Backend environment, usually `Backend/.env`:

```env
SUPABASE_POOLER_URL=...
SUPABASE_JWT_SECRET=...
ALLOWED_EMAIL_DOMAINS=my.fisk.edu
ALLOWED_ORIGINS=http://localhost:3000
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-oss-120b:free
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=FiskGrad
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Notes:

- `OPENROUTER_API_KEY` is required only for the AI advisor endpoint. The backend also accepts `OPENAI_API_KEY` as a fallback when using OpenRouter's OpenAI-compatible client, and it can read the old `GEMINI_API_KEY` name as a temporary legacy fallback.
- `OPENROUTER_MODEL` defaults to `openai/gpt-oss-120b:free`.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required for full backend account deletion.
- `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` and `ALLOWED_EMAIL_DOMAINS` should stay aligned.
- In production, `ALLOWED_ORIGINS` should include the deployed Vercel domain and should not be left as a wildcard.

## Database And Template Seeding

Requirement labels and templates can be seeded from backend scripts:

```bash
cd Backend
python scripts/seed_requirements.py --all
```

Apply production hardening in Supabase after reviewing the SQL:

```text
Backend/scripts/security_hardening.sql
```

## Deployment

The intended deployment split is:

- Vercel for the Next.js frontend
- Render for the FastAPI backend
- Supabase for database and auth
- A cron monitor that calls the backend health route to keep the Render service warm

### Vercel

Recommended settings:

| Setting | Value |
|---|---|
| Root directory | `web` |
| Build command | `npm run build` |
| Output | Next.js default |

Required frontend environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=my.fisk.edu
```

### Render

Recommended backend settings:

| Setting | Value |
|---|---|
| Root directory | `Backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

Required backend environment variables:

```env
SUPABASE_POOLER_URL=...
SUPABASE_JWT_SECRET=...
ALLOWED_EMAIL_DOMAINS=my.fisk.edu
ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-oss-120b:free
OPENROUTER_SITE_URL=https://your-vercel-domain.vercel.app
OPENROUTER_APP_NAME=FiskGrad
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Keep-Alive Cron

Use a cron service to call:

```text
GET https://your-render-service.onrender.com/api/health
```

A 10-minute interval is usually enough for keeping a free or low-cost Render service responsive. This should only hit the health route and should not call authenticated or expensive endpoints.

## Validation

Backend syntax check:

```bash
python -m py_compile Backend/app/auth.py Backend/app/main.py Backend/app/db.py
```

Frontend type check:

```bash
npx --prefix web tsc --noEmit
```

Frontend production build:

```bash
npm --prefix web run build
```

The production build may require network access because Next.js can fetch configured fonts during build.

## Current Status

FiskGrad is best described as a feature-complete MVP or beta candidate. Apart from testing, deployment, and production setup, the planned MVP product work is in place.

The main product logic is in place:

- Fisk-only student access checks
- transcript PDF import
- planning workflow
- requirement tracking
- credit-threshold requirement groups
- advisor-ready balance sheets
- 14 student-provided working major templates
- custom PDF, Word, and image sheet preview
- course search and sections
- calendar export
- reviews
- AI advisor endpoint
- Supabase security hardening script
- Vercel and Render deployment path

Before treating it as production-ready, the remaining work should focus on:

- running the Supabase hardening SQL in the real project
- testing real Fisk student sign-up and login flows
- testing transcript imports with multiple real transcript formats
- testing the student-provided balance-sheet templates inside the app with real student plans
- adding end-to-end tests for transcript import, planner save, requirements, and balance sheet
- confirming production CORS, headers, and environment variables
- validating account deletion and data removal behavior
- reviewing privacy language with the final product policy

## Product Direction

FiskGrad can grow into a real system or startup if it stays focused on trust.

The strongest wedge is not generic AI advising. The strongest wedge is accurate, student-owned degree progress:

- transcript-aware
- major-aware
- advisor-readable
- schedule-aware
- secure enough for student academic records

If the system becomes the place where students can reliably answer "what do I need to graduate and what should I take next?", it can expand into advisor dashboards, department analytics, official degree-audit integrations, transfer evaluation support, and registration planning.

The product should keep one principle clear: FiskGrad helps students understand and prepare, while official academic decisions still belong to Fisk University advisors, departments, and registrar records.
