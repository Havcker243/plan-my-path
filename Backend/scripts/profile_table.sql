create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text,
  name text,
  avatar_url text,
  major_code text,
  graduation_year int,
  graduation_term text,
  start_year int,
  start_term text,
  completed_courses text[],
  gpa numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_user_id on profiles(user_id);
