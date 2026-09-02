-- Parlay Pool schema.
-- Apply with `npm run db:init` (safe to re-run).

create table if not exists legs (
  id         uuid primary key default gen_random_uuid(),
  season     integer     not null,
  week       integer     not null,
  name       text        not null,
  pick       text        not null,
  odds       integer     not null check (abs(odds) >= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One leg per person per week. Case-insensitive so "dylan" can't sit alongside
-- "Dylan"; the upsert in store.ts targets this index.
create unique index if not exists legs_one_per_person
  on legs (season, week, lower(name));

-- The board only ever reads a single week.
create index if not exists legs_by_week
  on legs (season, week, created_at);
