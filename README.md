# Fiskpath

Fiskpath is an academic planning product for students who need a clearer path from transcript history to graduation. It brings together degree planning, transcript import, requirement tracking, course search, section scheduling, calendar export, student reviews, AI advisor support, and advisor-facing balance sheets.

The larger goal is not just to make a prettier planner. The goal is to help a student answer the practical questions that usually require jumping between transcripts, catalog pages, advisor PDFs, schedule builders, and manual spreadsheets:

- What have I already completed?
- What am I currently taking?
- What still counts toward my major?
- Which semester should each remaining course go in?
- Which sections can I actually take?
- What schedule does that create?
- What can I print or share with my advisor?

## Vision

Fiskpath should become a student-owned academic planning workspace.

Students should be able to upload their transcript, pick their major, see a realistic semester-by-semester plan, choose sections, export their calendar, and print an advisor-ready balance sheet. Advisors should be able to quickly understand what the student has taken, what is planned, what remains, and where the plan may need correction.

The product should be useful even without AI. AI should improve explanations, suggestions, and planning support, but the core planner, requirements logic, transcript import, calendar, and balance-sheet output should remain deterministic and inspectable.

## Why This Exists

Degree planning is fragmented. Students often have to combine:

- a transcript PDF
- a course catalog
- a major balance sheet
- advisor notes
- registration sections
- calendar conflicts
- unofficial spreadsheets

That causes mistakes:

- completed courses may not get counted correctly
- current in-progress courses may be ignored because they have no grade yet
- transfer credits may be hard to place
- prerequisite warnings may be noisy or wrong
- students may not know which requirements are actually satisfied
- advisors may not receive a clean, printable view

Fiskpath is designed to reduce that friction by turning those pieces into one connected planning flow.

## Current Product

The app currently supports these major areas:

- **Dashboard**: summary of degree progress, plan status, and quick links.
- **Onboarding**: collects major, start term, graduation target, and completed courses.
- **Transcript Import**: parses PDF transcript data into completed and in-progress course rows.
- **Planner**: semester-by-semester course planning, drag/drop, add/remove courses, add/remove semesters, section selection, autosave, GPA/credit display, and warnings.
- **Requirements**: major requirement tracking and degree-audit style progress.
- **Courses**: authenticated catalog browsing, course details, sections, and reviews.
- **Explore**: public course search/browsing entry point.
- **Calendar**: selected-section weekly schedule with location display and `.ics` download.
- **Hub / Reviews**: student course feedback and review surfaces.
- **AI Advisor**: Gemini-backed advisor endpoint, optional and guarded so the backend can boot without AI dependencies.
- **Balance Sheet**: major-template-backed advisor balance sheet with print support and local custom-sheet preview.

## Product Principles

These principles should guide future work:

- **Transcript truth matters**: completed courses, grades, credits, term, and year should be preserved when possible.
- **In-progress is not missing**: courses without grades should usually be treated as planned/current, not skipped.
- **Advisor output matters**: the app should produce printable, understandable artifacts, not only interactive UI.
- **Major sheets vary**: balance sheets should be handled per major, not forced into one universal flat table.
- **AI is assistive, not authoritative**: deterministic rules should own core planning logic; AI can explain and recommend.
- **Performance matters**: switching tabs and opening course details should not refetch everything unnecessarily.
- **Features must stand alone**: planner, requirements, calendar, transcript import, and balance sheet should share source data but not depend on each other's UI assumptions.

## Architecture Standard

The project architecture guide lives here:

- [docs/architecture/README.md](./docs/architecture/README.md)

The short version:

```text
shared core data -> isolated feature engines -> thin UI layers
```

Shared core data includes:

- auth/session
- profile
- plan semesters and course catalog
- course catalog and sections
- major template data
- transcript parse results

Feature engines live in `web/lib/*` and should handle transformations without UI concerns.

Important frontend modules:

- `web/lib/api.ts`: API client and backend types
- `web/lib/api-adapters.ts`: backend-to-frontend adapters
- `web/lib/plan-state.ts`: pure plan state and save-payload builders
- `web/lib/course-utils.ts`: course code, term, and label utilities
- `web/lib/transcript.ts`: frontend transcript/onboarding helpers
- `web/lib/planner.ts`: planner helpers
- `web/lib/calendar.ts`: calendar helpers
- `web/lib/requirements.ts`: requirements helpers
- `web/lib/balance-sheet.ts`: balance-sheet view-model builder
- `web/lib/balance-sheet-templates.ts`: supported major template registry
- `web/lib/nav.ts`: navigation source of truth

## Repo Layout

```text
plan-my-path/
  Backend/                  FastAPI backend
  Backend/app/              API, auth, DB, transcript parser, AI advisor
  Backend/scripts/          SQL, sync, and seed scripts
  data/                     source balance sheets, transcript samples, root template data
  docs/architecture/        architecture README and engineering guidance
  web/                      Next.js frontend
  web/app/                  Next.js App Router routes
  web/components/           page and UI components
  web/contexts/             auth and plan providers
  web/data/                 frontend-owned balance-sheet template JSON
  web/lib/                  feature engines, API client, utilities
  future plans.md           future-facing roadmap notes
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Framer Motion |
| Backend | FastAPI, Python |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| AI | Gemini via `google-generativeai` |
| Transcript Parsing | Python PDF parsing |
| Calendar Export | Frontend-generated `.ics` |

## Backend API

Key endpoints:

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | backend health |
| GET | `/api/subjects` | course subject acronyms |
| GET | `/api/majors` | degree programs |
| GET | `/api/courses` | courses by subject |
| GET | `/api/courses/search` | catalog search |
| GET | `/api/sections` | sections for course codes |
| GET | `/api/course-labels` | requirement labels and elective rules for a major |
| GET/PUT | `/api/profile` | student profile |
| GET/PUT | `/api/plan` | saved academic plan |
| POST | `/api/transcript` | parse transcript PDF |
| GET/POST | `/api/reviews` | course reviews |
| GET | `/api/reviews/recent` | recent review feed |
| POST | `/api/ai/advise` | AI advisor reply |
| DELETE | `/api/account` | account and plan deletion |

## Transcript Import Direction

Transcript import is a core feature.

Expected behavior:

- preserve completed courses
- preserve grades, credits, term, and year when available
- keep in-progress courses even when they have no final grade
- treat no-grade current courses as planned/current, not failed imports
- show unmatched courses for verification instead of silently dropping them
- support transfer-credit sections before normal term headers
- avoid prerequisite warnings for already-completed transcript courses

Backend parser:

- `Backend/app/transcript.py`

Frontend transcript helpers:

- `web/lib/transcript.ts`

Transcript import still has sensitive logic in:

- `web/contexts/plan-context.tsx`

That area should be refactored carefully only after testing transcript import end to end.

## Planner Direction

The planner is the main interactive workspace.

It currently supports:

- semester columns
- add/remove semesters
- add/remove courses
- drag/drop between semesters
- course search
- course detail modal
- section selection
- explicit section save
- GPA and credit display
- prerequisite/offered-term warnings
- clear-all action
- autosave/debounced save

The largest remaining planner file is:

- `web/components/planner-page.tsx`

Future split order:

1. `SectionOptionCard`
2. `CourseCard`
3. `SemesterColumn`
4. `AddCourseDialog`
5. `CourseDetailDialog`
6. keep only page-level state and save orchestration in `PlannerPage`

## Calendar Direction

The calendar should show what the student's selected sections actually create.

Current behavior:

- reads selected sections
- shows Monday through Friday grid
- parses AM/PM correctly
- shows meeting location
- supports `.ics` download
- skips malformed meeting times instead of crashing

Future decisions:

- whether weekend classes should appear visually or only export to `.ics`
- whether to add conflict explanations directly in the calendar UI

## Balance Sheet Direction

Balance sheets are advisor-facing documents. They should not be treated like a generic course table.

Current behavior:

- system templates are supported for selected majors
- unsupported majors show an unavailable state
- completed rows show mark, grade, term, and credits
- planned rows show planned term
- print flow exists
- local custom PDF/image preview exists

Supported frontend templates currently live in:

- `web/data/`

The original source/template artifacts live in:

- `data/`

This duplication exists because the Next/Turbopack frontend is rooted at `web`, so frontend imports cannot reliably import JSON from repo-level `data/`.

Current supported template majors include:

- Accounting
- Business Administration Non-Concentration
- Business Information Systems A.S.
- Computer Science
- Finance Economics
- Management
- Marketing
- Mathematics B.A.
- Music Business
- Physics

Important product rule:

Each major should be able to have its own balance-sheet structure. Do not force all majors into one universal layout. When a real balance sheet is provided for a major, support that major's sheet directly.

Future balance-sheet work:

- polish print layout to look closer to real institutional sheets
- persist uploaded custom sheets per user
- add templates for remaining majors only when real source sheets exist
- eventually add an editor for per-major balance-sheet structures if needed

## Performance Direction

Several performance issues have already been addressed:

- term calendar is cached
- repeated profile/plan reloads from auth token churn were reduced
- section data is cached through `PlanProvider`
- course search results are cached
- subject acronym loading is cached
- planner and calendar share section loading

Performance rules going forward:

- do not refetch public data on every route change
- do not make access-token refresh trigger full app reloads
- keep expensive transformations in `web/lib/*`
- memoize or cache repeated search/section/template operations

## Known Technical Debt

Current known issues and cleanup targets:

- `planner-page.tsx` is still large and should be split into smaller components.
- `plan-context.tsx` is smaller than before but still owns onboarding/transcript import behavior.
- prerequisite parsing needs a deeper cleanup pass.
- some files contain encoding artifacts such as `â€”` or `â€¢` in comments/text.
- balance-sheet templates currently exist in both `data/` and `web/data/`.
- custom uploaded balance sheets are local-preview only and not persisted.
- `plan-context.tsx` has a Fast Refresh warning because it exports both provider/hook style items.

## Running Locally

### Frontend

```bash
cd web
npm install
npm run dev
```

### Backend

```bash
cd Backend
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Environment Variables

### Frontend `web/.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Backend `Backend/.env`

```env
SUPABASE_POOLER_URL=...
SUPABASE_JWT_SECRET=...
ALLOWED_ORIGINS=http://localhost:3000
GEMINI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Notes:

- `GEMINI_API_KEY` is only required for AI advisor functionality.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required for full Supabase auth-user deletion.
- The backend can now boot even if the Gemini package is missing, but the advisor endpoint needs `google-generativeai`.

## Validation Commands

Frontend:

```bash
cd web
npx tsc --noEmit
npx eslint .
```

Backend:

```bash
python -m py_compile Backend/app/main.py Backend/app/advisor.py Backend/app/transcript.py
```

## Recommended Next Steps

1. Smoke test the full app:
   - login
   - onboarding
   - transcript import
   - dashboard
   - planner
   - section selection
   - calendar
   - `.ics` export
   - course search
   - balance sheet

2. Split the planner UI:
   - start with section cards and course cards
   - then semester columns
   - then dialogs

3. Stabilize transcript/onboarding:
   - test current import behavior
   - only then extract the remaining heavy logic from `plan-context.tsx`

4. Improve balance-sheet output:
   - make print view closer to advisor sheets
   - add remaining majors only from real source sheets
   - decide how to handle custom-sheet persistence

5. Clean up technical debt:
   - encoding artifacts
   - deeper prerequisite parsing
   - template source-of-truth duplication

## Project Status

Fiskpath is in feature-integration and stabilization mode.

The core product is present. The next work should focus on correctness, testing, UI splitting, advisor-ready output polish, and making sure each feature can stand on its own without slowing or destabilizing the rest of the app.
