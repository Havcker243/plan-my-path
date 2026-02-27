create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  name text default 'My Academic Plan',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_plans_user_id on plans(user_id);

create table if not exists plan_semesters (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  term text not null,
  year int not null,
  label text not null,
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_plan_semesters_plan on plan_semesters(plan_id);

create table if not exists plan_courses (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references plan_semesters(id) on delete cascade,
  course_code text not null,
  status text not null default 'planned',
  grade text,
  credits numeric,
  selected_section_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_plan_courses_semester on plan_courses(semester_id);
create index if not exists idx_plan_courses_code on plan_courses(course_code);
