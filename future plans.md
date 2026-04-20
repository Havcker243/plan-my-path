# Future Plans

These are not part of the current finish scope for the app. They are future-facing features to revisit after the existing product is stable and complete.

## Current Product Baseline

FiskGrad is considered feature-complete for the MVP/beta scope apart from testing, deployment, and production setup.

The current balance-sheet templates were provided by real students and are accepted as the working source set for this version of the product. The remaining template work is not to add more MVP features, but to test them in the app, catch edge cases, and improve polish after real usage.

Current baseline:
- Fisk-only access using `@my.fisk.edu`
- transcript PDF import
- semester-by-semester planner
- requirements tracking
- credit-threshold requirement groups
- advisor-ready balance sheets
- 14 student-provided working templates
- custom PDF, Word document, and image sheet upload preview
- course search, sections, calendar export, reviews, profile, and AI advisor support

What remains before launch:
- test the full student flow end to end
- deploy the frontend and backend
- run Supabase security hardening
- configure production environment variables
- set up the Render keep-alive cron
- rename the actual local/GitHub project folder to `fiskgrad`

## 1. Startup Validation Track

Once this project is in a stronger state, evaluate whether it has startup potential before expanding it further.

Focus areas:
- Identify the primary customer clearly before building for everyone.
- Validate whether the planning problem is painful enough for real users.
- Test whether students, advisors, or schools would actually use and trust the product.
- Look for proof of demand through interviews, repeated usage, waitlists, pilots, or willingness to pay.

Goal:
- Decide whether this should remain a portfolio/product project or evolve into something with real business potential.

## 2. AI-Assisted Proposed Degree Plan

Build a feature that creates a recommended semester-by-semester academic path for a student based on what they have left to complete.

Inputs:
- Completed courses
- Remaining degree requirements
- Expected graduation timeline
- Semesters left
- Credit load preferences
- Optional user constraints such as avoiding summer, lighter semesters, or scheduling preferences

Expected behavior:
- Analyze remaining classes and unmet requirements
- Respect prerequisites and course ordering
- Consider term availability when possible
- Distribute courses across remaining semesters
- Produce a proposed plan the student can review and modify

User controls:
- Accept the full proposed plan
- Edit semesters manually
- Lock certain courses or semesters
- Regenerate around chosen constraints
- Reject the proposal and try another version

Target use case:
- Help freshmen and other students who do not know what to take first or how to finish on time.

Implementation note:
- Start with deterministic rules-based planning first.
- Add AI later for explanation, optimization, and customization rather than relying on unconstrained generation.

## 3. Class Reviews and Teacher Discussion Forum

Build a shared commenting and review system for classes so students can describe their experience and create useful feedback data for future AI features.

Core functionality:
- Let logged-in users leave comments and reviews on any class.
- Let users leave feedback directly from class search results and from the class detail page.
- Let users talk about both the class itself and the teacher who teaches it.
- Show the comment author's username with each post.
- Make reviews and comments visible to any user with an account.
- Preserve the discussion history so each class can function like a lightweight forum thread.

Expected behavior:
- A user searches for a class, opens it, and can immediately read existing comments.
- That same user can post their own feedback about workload, difficulty, teaching quality, pacing, usefulness, or anything else relevant.
- Users should be able to describe differences between instructors when the same class is taught by different teachers.
- Other signed-in users should be able to browse the discussion later and use it to make better planning decisions.

AI value:
- Treat class reviews and teacher discussion as future training/context data for AI recommendations.
- Use the feedback later to help the AI explain why a class may be a good fit, too difficult, well-taught, or worth avoiding under certain conditions.

Implementation note:
- Design this as a class-centered forum system, not just a single short review field.
- Keep identity tied to the user's account username for accountability and readability.
