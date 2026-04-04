# Plan My Path

Plan My Path is an academic planning app for students who want to map degree progress across semesters, browse courses, understand requirements, and keep a workable graduation path in one place.

The repo currently contains:
- a FastAPI backend
- an older Vite/React frontend in `Frontend/` (kept as feature reference)
- a newer Next.js frontend in `web/` that is actively connected to the backend and replacing the old UI

## Current Product Scope

Implemented or partially implemented:
- onboarding flow for major, timeline, and completed courses
- authenticated profile management with Supabase auth
- semester-by-semester planner
- course search and catalog browsing
- requirement labels for major courses
- section lookup for course scheduling
- calendar view based on selected sections
- profile and plan persistence through the backend

## Architecture

### Backend

Location:
- `Backend/`

Responsibilities:
- expose REST endpoints for profile, plan, course, section, subject, term, and label data
- validate authenticated requests using Supabase JWTs
- persist profile and plan data to Supabase Postgres

Main backend entrypoints:
- `Backend/app/main.py`
- `Backend/app/db.py`

### Frontends

#### Active frontend (`web/`)

Location:
- `web/`

Stack:
- Next.js App Router
- React
- TypeScript
- Tailwind
- shadcn-ui
- Supabase auth

Status:
- active development target
- fully connected to the backend for profile, plan, labels, courses, sections, and calendar data
- replacing `Frontend/` once parity is confirmed

#### Legacy frontend (`Frontend/`)

Location:
- `Frontend/`

Stack:
- Vite
- React
- TypeScript
- Tailwind
- shadcn-ui

Status:
- kept as behavioral reference during migration
- no longer the target UI

## Repo Layout

- `Backend/` FastAPI backend and SQL/scripts
- `web/` new Next.js frontend (active)
- `Frontend/` old Vite frontend (reference only)
- `data/` local requirement and course artifacts
- `future plans.md` product roadmap and future implementation notes

## API Surface

The backend exposes these endpoints used by the frontend:
- `GET /api/majors`
- `GET /api/subjects`
- `GET /api/courses`
- `GET /api/courses/search`
- `GET /api/sections`
- `GET /api/course-labels`
- `GET /api/terms`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/plan`
- `PUT /api/plan`

## Local Development

### 1. Start the backend

```powershell
cd Backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Start the new frontend

```powershell
cd web
npm install
npm run dev
```

### 3. Optional: run the old frontend (for comparison only)

```powershell
cd Frontend
npm install
npm run dev
```

## Environment Variables

### Backend (`Backend/.env`)

```
SUPABASE_POOLER_URL=...
SUPABASE_JWT_SECRET=...
```

### New frontend (`web/.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Old frontend (`Frontend/.env`)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=...
```

## Migration Status

`web/` is wired for:
- login/signup/forgot-password session handling
- onboarding (major, timeline, completed courses → creates initial semester scaffold)
- profile fetch and update
- plan fetch and save (with debounced autosave)
- semester drag-drop with add/remove courses
- course search with subject/level/term filters
- requirement label loading per major
- selected section persistence per course
- calendar rendering from section meeting times with conflict detection

Remaining migration work:
- parity audit between `Frontend/` and `web/` for edge cases
- requirements correctness validation against actual degree data
- avatar upload pipeline (currently local preview only)

## Notes

- Supabase is used for auth and Postgres storage.
- The backend is the source of truth for profile and plan data.
- `web/` keeps all state backend-backed rather than local-only.
- `Frontend/` will be removed once `web/` parity is confirmed.
