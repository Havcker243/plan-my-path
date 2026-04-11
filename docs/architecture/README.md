# Architecture README

This project should follow one core rule:

Shared core data, isolated feature engines, thin UI layers.

## 1. Shared Core Data

The app should share only foundational data:

- auth and session
- profile
- plan semesters and course state
- course catalog and sections
- major template data
- transcript parse results

Pages should derive from these sources instead of inventing their own parallel models.

## 2. Feature Engines

Each major feature should have its own transformation layer:

- planner engine
- requirements engine
- calendar engine
- balance-sheet engine
- transcript engine

Each engine should:

- accept plain typed input
- return plain typed output
- avoid UI concerns
- avoid network calls when possible

## 3. Thin UI Layers

Pages and components should mostly:

- call a feature engine
- render the returned model
- trigger user actions

Heavy business logic should not live directly inside page components.

## 4. Strict Feature Boundaries

Features may share source data, but they should not depend on each other's internal assumptions.

Good:

- balance sheet reads plan data
- calendar reads selected sections

Bad:

- balance sheet depends on planner UI behavior
- requirements depends on calendar formatting

## 5. Stable Typed Models

Every feature should define:

- raw source input types
- normalized feature model types
- render-ready item or row types

Do not rely on loose object-shape guessing inside UI code.

## 6. Performance Rule

Expensive work should be:

- centralized
- memoized
- reused

Avoid repeated parsing, repeated fetching, and repeated page-local recomputation.

## 7. Growth Order

New features should be built in this order:

1. source data
2. normalization layer
3. UI rendering
4. export or print actions
5. advanced polish

## 8. Variation Rule

When a feature varies heavily by major, school, or document format:

- support multiple schemas explicitly
- do not force one generic flat model onto every case

This rule especially applies to balance sheets and transcripts.

## 9. Current Direction

Near-term modules should follow this pattern:

- `web/lib/planner.ts`
- `web/lib/requirements.ts`
- `web/lib/calendar.ts`
- `web/lib/balance-sheet.ts`
- `web/lib/transcript.ts`

## 10. Immediate Application

This standard should be applied first to the balance-sheet feature:

- keep major template JSON as the source of truth
- normalize templates into explicit row and group shapes
- keep printable rendering separate from template normalization
- add custom uploaded balance sheets only after the system-template path is stable
