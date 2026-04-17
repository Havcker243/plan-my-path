-- Production security hardening for Supabase.
-- Run this in the Supabase SQL editor before public launch.
--
-- Goals:
-- 1. Enable Row Level Security on user-owned tables.
-- 2. Restrict each student to their own profile and plan rows.
-- 3. Keep course reviews readable while requiring authenticated inserts.
-- 4. Restrict profile-picture storage paths to the authenticated user's folder.

-- ---------------------------------------------------------------------------
-- Supabase Auth email-domain guard
-- ---------------------------------------------------------------------------

-- Fisk student accounts must use @my.fisk.edu. This trigger blocks direct
-- Supabase signups or email changes that bypass the frontend/backend checks.
-- Review existing auth users before enabling this if you already have test
-- accounts with other domains:
--
-- SELECT id, email FROM auth.users WHERE lower(email) NOT LIKE '%@my.fisk.edu';

CREATE OR REPLACE FUNCTION public.enforce_my_fisk_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR lower(NEW.email) NOT LIKE '%@my.fisk.edu' THEN
    RAISE EXCEPTION 'Only @my.fisk.edu email addresses are allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_my_fisk_email_on_auth_users ON auth.users;
CREATE TRIGGER enforce_my_fisk_email_on_auth_users
BEFORE INSERT OR UPDATE OF email
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_my_fisk_email();

-- ---------------------------------------------------------------------------
-- User-owned app tables
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.plan_semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.plan_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
ON public.profiles
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plans_select_own" ON public.plans;
CREATE POLICY "plans_select_own"
ON public.plans
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plans_insert_own" ON public.plans;
CREATE POLICY "plans_insert_own"
ON public.plans
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plans_update_own" ON public.plans;
CREATE POLICY "plans_update_own"
ON public.plans
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plans_delete_own" ON public.plans;
CREATE POLICY "plans_delete_own"
ON public.plans
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plan_semesters_select_own" ON public.plan_semesters;
CREATE POLICY "plan_semesters_select_own"
ON public.plan_semesters
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.plans p
    WHERE p.id = plan_semesters.plan_id
      AND p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "plan_semesters_insert_own" ON public.plan_semesters;
CREATE POLICY "plan_semesters_insert_own"
ON public.plan_semesters
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.plans p
    WHERE p.id = plan_semesters.plan_id
      AND p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "plan_semesters_update_own" ON public.plan_semesters;
CREATE POLICY "plan_semesters_update_own"
ON public.plan_semesters
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.plans p
    WHERE p.id = plan_semesters.plan_id
      AND p.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.plans p
    WHERE p.id = plan_semesters.plan_id
      AND p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "plan_semesters_delete_own" ON public.plan_semesters;
CREATE POLICY "plan_semesters_delete_own"
ON public.plan_semesters
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.plans p
    WHERE p.id = plan_semesters.plan_id
      AND p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "plan_courses_select_own" ON public.plan_courses;
CREATE POLICY "plan_courses_select_own"
ON public.plan_courses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.plan_semesters ps
    JOIN public.plans p ON p.id = ps.plan_id
    WHERE ps.id = plan_courses.semester_id
      AND p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "plan_courses_insert_own" ON public.plan_courses;
CREATE POLICY "plan_courses_insert_own"
ON public.plan_courses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.plan_semesters ps
    JOIN public.plans p ON p.id = ps.plan_id
    WHERE ps.id = plan_courses.semester_id
      AND p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "plan_courses_update_own" ON public.plan_courses;
CREATE POLICY "plan_courses_update_own"
ON public.plan_courses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.plan_semesters ps
    JOIN public.plans p ON p.id = ps.plan_id
    WHERE ps.id = plan_courses.semester_id
      AND p.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.plan_semesters ps
    JOIN public.plans p ON p.id = ps.plan_id
    WHERE ps.id = plan_courses.semester_id
      AND p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "plan_courses_delete_own" ON public.plan_courses;
CREATE POLICY "plan_courses_delete_own"
ON public.plan_courses
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.plan_semesters ps
    JOIN public.plans p ON p.id = ps.plan_id
    WHERE ps.id = plan_courses.semester_id
      AND p.user_id = (SELECT auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.course_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_reviews_public_read" ON public.course_reviews;
CREATE POLICY "course_reviews_public_read"
ON public.course_reviews
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "course_reviews_authenticated_insert" ON public.course_reviews;
CREATE POLICY "course_reviews_authenticated_insert"
ON public.course_reviews
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- ---------------------------------------------------------------------------
-- ProfilePictures storage bucket
-- ---------------------------------------------------------------------------

-- The frontend writes objects as: <auth.uid()>/avatar.<ext>
-- Current frontend stores public avatar URLs, so the bucket remains public.
-- Writes are still restricted to the authenticated user's own folder.

UPDATE storage.buckets
SET public = true
WHERE id = 'ProfilePictures';

DROP POLICY IF EXISTS "profile_pictures_public_read" ON storage.objects;
CREATE POLICY "profile_pictures_public_read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'ProfilePictures'
);

DROP POLICY IF EXISTS "profile_pictures_insert_own" ON storage.objects;
CREATE POLICY "profile_pictures_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ProfilePictures'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

DROP POLICY IF EXISTS "profile_pictures_update_own" ON storage.objects;
CREATE POLICY "profile_pictures_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ProfilePictures'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'ProfilePictures'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

DROP POLICY IF EXISTS "profile_pictures_delete_own" ON storage.objects;
CREATE POLICY "profile_pictures_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ProfilePictures'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
