# Fiskpath

Fiskpath is an academic planning app for university students. It combines degree planning, transcript import, requirement tracking, course search, section scheduling, calendar view, reviews, and advisor-facing balance-sheet work in one product.

## Current Product

- Planner: semester-by-semester course planning with autosave
- Requirements: major requirement tracking and degree audit
- Transcript Import: PDF transcript parsing into completed and in-progress courses
- Courses and Explore: catalog browsing, sections, descriptions, and reviews
- Calendar: section-based weekly schedule with conflict detection and `.ics` export
- Hub: student reviews plus AI advisor support
- Balance Sheet: new template-backed advisor sheet feature in progress

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Framer Motion |
| Backend | FastAPI, Python |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| AI | Gemini |

## Repo Layout

```text
plan-my-path/
  web/                    Next.js frontend
  Backend/                FastAPI backend
  Backend/scripts/        SQL, sync, and seed scripts
  data/                   Major templates and local source artifacts
  docs/architecture/      Product architecture guidance
  future plans.md         Product roadmap notes
```

## Architecture

Architecture guidance now lives here:

- [docs/architecture/README.md](./docs/architecture/README.md)

The current standard is:

- shared core data
- isolated feature engines
- thin UI layers

That rule is especially important now that the product includes planner, requirements, transcript import, calendar, reviews, and balance-sheet generation.

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
```

## Current Data Direction

- `data/*.json` contains major-specific balance-sheet template data
- transcript parsing lives in `Backend/app/transcript.py`
- frontend plan state is coordinated through `web/contexts/plan-context.tsx`
- balance-sheet rendering logic is being built in `web/lib/balance-sheet.ts`

## Key Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/majors` | list degree programs |
| GET | `/api/courses` | courses by subject |
| GET | `/api/courses/search` | course search |
| GET | `/api/sections` | section data |
| GET | `/api/course-labels` | requirement labels for a major |
| GET/PUT | `/api/profile` | student profile |
| GET/PUT | `/api/plan` | student plan |
| POST | `/api/transcript` | transcript parse |
| GET/POST | `/api/reviews` | course reviews |
| POST | `/api/ai/advise` | AI advisor |

## Notes

- The balance-sheet feature is being rebuilt around major-template-driven rendering rather than a single flat course table.
- Custom uploaded balance sheets are planned after the system-template version is stable.
- If you are trying to understand current architectural direction, start with the architecture README before reading page-level UI code.
