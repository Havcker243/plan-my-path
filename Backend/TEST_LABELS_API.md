# Testing the Course Labels API

## What We Built

A new API endpoint that returns requirement labels for courses based on a student's major.

### Endpoint

```
GET /api/course-labels?major_code=CSCI&course_codes=CSCI-241,SOC-100,MATH-120
```

### Parameters

- `major_code` (required): The major code (e.g., "CSCI")
- `course_codes` (optional): Comma-separated list of course codes to label

### Response Format

```json
{
  "data": {
    "CSCI-241": {
      "label": "Required",
      "group_name": "Major Requirements",
      "group_type": "all_of",
      "detail": "Required for Major Requirements",
      "credits": 3
    },
    "SOC-100": {
      "label": "Group Choice",
      "group_name": "CORE - Group E: Social Science",
      "group_type": "choose_one",
      "detail": "Choose one from CORE - Group E: Social Science",
      "credits": 3
    },
    "MATH-120": {
      "label": "Required",
      "group_name": "Required Cognates",
      "group_type": "all_of",
      "detail": "Required for Required Cognates",
      "credits": 4
    }
  }
}
```

### Label Types

1. **"Required"** - Must take this course (from all_of groups)
   - Example: CSCI-241, MATH-120, CORE-100

2. **"Group Choice"** - Pick one from a group (from choose_one groups)
   - Example: SOC-100 (one of Group E options), MUS-205 (one of Group C options)

3. **"Major Elective"** - Counts toward major electives (from pattern rules)
   - Example: CSCI-280, CSCI-265 (any CSCI 200+ not in required list)

4. **"General Elective"** - Fills remaining credits to reach 120
   - Example: Any course not matching above categories

## How to Test

### 1. Restart the Backend Server

```bash
cd Backend
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Test Specific Courses

```bash
# Test major required course
curl "http://localhost:8000/api/course-labels?major_code=CSCI&course_codes=CSCI-241"

# Test group choice course
curl "http://localhost:8000/api/course-labels?major_code=CSCI&course_codes=SOC-100"

# Test major elective (CSCI 200+ level not in required)
curl "http://localhost:8000/api/course-labels?major_code=CSCI&course_codes=CSCI-280"

# Test multiple courses at once
curl "http://localhost:8000/api/course-labels?major_code=CSCI&course_codes=CSCI-241,SOC-100,MATH-120,CSCI-280,ECON-230"
```

### 3. Get All Labeled Courses for CS Major

```bash
# Returns all explicitly labeled courses + elective rules
curl "http://localhost:8000/api/course-labels?major_code=CSCI"
```

## Expected Results

### For CSCI-241:
```json
{
  "label": "Required",
  "group_name": "Major Requirements",
  "detail": "Required for Major Requirements"
}
```

### For SOC-100 or ECON-230 (Group E):
```json
{
  "label": "Group Choice",
  "group_name": "CORE - Group E: Social Science",
  "detail": "Choose one from CORE - Group E: Social Science"
}
```

### For CSCI-280 (200+ level, not required):
```json
{
  "label": "Major Elective",
  "group_name": "Major Required Electives",
  "detail": "CSCI 200+ level"
}
```

### For Any Other Course:
```json
{
  "label": "General Elective",
  "group_name": "General Electives",
  "detail": "Counts toward 120 total credits"
}
```

## Database Functions Added

### `fetch_course_labels(pooler_url, major_code)`
- Queries requirement_courses, requirement_groups, requirement_rules tables
- Returns all labeled courses and elective rules for a major

### `get_course_label(course_code, labels_data)`
- Applies labeling logic to a single course
- Handles pattern matching for major electives (CSCI 200+)
- Returns label object with type, group, and detail

## Files Modified

1. `Backend/app/db.py` - Added `fetch_course_labels()` and `get_course_label()` functions
2. `Backend/app/main.py` - Added `/api/course-labels` endpoint
