create table if not exists term_calendar (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  year int not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(term, year)
);
