# Parse.bot Setup

This project uses a Parse.bot scraper for Fisk University course catalog and section data.

## Scraper

- Parse.bot base URL:
  - `https://api.parse.bot/scraper/37fd40d8-afe7-4fa5-80dc-adcbc4147728`

- Source site used for the scraper:
  - `https://fisk-ss.colleague.elluciancloud.com/student/Courses/Search?subjects=CSCI`

- Multi-subject source pattern:
  - `https://fisk-ss.colleague.elluciancloud.com/student/Courses/Search?subjects={SUBJECT_CODE}`

## Parse.bot Endpoints

- `GET /get_course_list`
- `GET /get_course_details`
- `GET /get_available_sections`
- `GET /get_all_courses_with_sections`
- `GET /get_catalog_snapshot`

Full base path example:

```text
https://api.parse.bot/scraper/37fd40d8-afe7-4fa5-80dc-adcbc4147728/get_course_list
```

## Environment Variables

Set these in `Backend/.env`:

```env
PARSE_BOT_API_KEY=your_parse_bot_api_key
PARSE_BOT_BASE_URL=https://api.parse.bot/scraper/37fd40d8-afe7-4fa5-80dc-adcbc4147728
SUPABASE_POOLER_URL=your_supabase_postgres_pooler_url
```

Notes:
- `PARSE_BOT_API_KEY` is the key used by the scripts.
- `PARSE_BOT_BASE_URL` is optional if you want to override the default scraper URL.
- `SUPABASE_POOLER_URL` is required for DB sync.

## Project Scripts

The project scripts already wired to this scraper are:

- [Backend/scripts/parse_bot_scrape.py](/C:/Users/dolap/Desktop/Projects/plan-my-path/Backend/scripts/parse_bot_scrape.py)
- [Backend/scripts/sync_supabase.py](/C:/Users/dolap/Desktop/Projects/plan-my-path/Backend/scripts/sync_supabase.py)

What they do:

- `parse_bot_scrape.py`
  - fetches raw payloads from Parse.bot
  - supports list, details, sections, subject-wide, and snapshot modes

- `sync_supabase.py`
  - reads subjects from `Backend/scripts/courses.txt`
  - fetches `get_all_courses_with_sections`
  - upserts subjects, courses, sections, instructors, and meeting times into Supabase

## Commands

Run from `Backend/`.

### 1. Test one subject list

```powershell
python scripts/parse_bot_scrape.py --mode list --subject CSCI --out data\csci_list.json --format json
```

### 2. Test one course details

```powershell
python scripts/parse_bot_scrape.py --mode details --course CSCI-110 --out data\csci_110_details.json --format json
```

### 3. Test one course sections

```powershell
python scripts/parse_bot_scrape.py --mode sections --course CSCI-100 --out data\csci_100_sections.json --format json
```

### 4. Test one subject full payload

```powershell
python scripts/parse_bot_scrape.py --mode all --subject CSCI --out data\csci_full.json --format json
```

### 5. Test multi-subject snapshot

```powershell
python scripts/parse_bot_scrape.py --mode snapshot --subjects CSCI,MATH,ART,CORE --out data\catalog_snapshot.json --format json
```

### 6. Sync one subject to Supabase

```powershell
python scripts/sync_supabase.py --subject CSCI
```

### 7. Sync all subjects to Supabase

```powershell
python scripts/sync_supabase.py
```

## Current API Shape Expected By The Sync Script

### Course payload fields

- `subject_code`
- `course_code`
- `title`
- `description`
- `credits_min`
- `credits_max`
- `credit_type`
- `locations`
- `locations_raw`
- `requisites_raw`
- `prerequisites`
- `corequisites`
- `source_url`
- `scraped_at`
- `terms`

### Section payload fields

- `section_code`
- `section_id`
- `term`
- `term_code`
- `status`
- `campus`
- `modality`
- `start_date`
- `end_date`
- `seats_available`
- `seats_capacity`
- `seats_enrolled`
- `seats_waitlisted`
- `instructors`
- `meeting_times`

## Subject Source List

Bulk sync subjects are read from:

- [Backend/scripts/courses.txt](/C:/Users/dolap/Desktop/Projects/plan-my-path/Backend/scripts/courses.txt)

Those subject URLs follow the Fisk search pattern and are used to determine which subjects to sync.
