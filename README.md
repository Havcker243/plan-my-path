# Plan My Path

A work-in-progress academic planning app that helps students map out a multi-semester course plan, track progress, and stay on track for graduation. The product is still evolving, so expect rough edges and rapid iteration.

## What it does (so far)

- Onboarding flow to capture major, start term, graduation target, and completed courses.
- Planner with drag-and-drop semesters, prerequisite validation, and credit warnings.
- Course catalog browser and section availability checks.
- Dashboard with progress, GPA, and upcoming semester preview.
- Profile management backed by Supabase.

## Tech stack

- Frontend: Vite, React, TypeScript, Tailwind, shadcn-ui
- Backend: FastAPI (Python)
- Data: Supabase Postgres

## Repo layout

- `Frontend/` React app
- `Backend/` FastAPI app + data scripts
- `data/` local data artifacts (not intended for production)
- `logs/` local logs

## Local development

### Frontend

```sh
npm install
npm run dev
```

### Backend

```sh
cd Backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Environment variables

Frontend expects:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` (optional, defaults to `http://localhost:8000`)

Backend expects:
- `SUPABASE_POOLER_URL`
- `SUPABASE_JWT_SECRET`

## Status

Early-stage prototype. Features are still being shaped and data workflows are in flux.
