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

-- Per-leg outcome, graded once the parlay is locked. Null means "not graded
-- yet"; the parlay is lost the moment any leg is 'lost'.
alter table legs
  add column if not exists result text;

-- Re-runnable: `add constraint` on its own would fail the second time.
alter table legs
  drop constraint if exists legs_result_valid;
alter table legs
  add constraint legs_result_valid check (result in ('won', 'lost'));

-- One row per week of the season, holding the week's parlay state. A row is
-- created when the parlay is locked, so a missing row means "still open".
-- This is also where a settled week's bookkeeping will hang off later.
create table if not exists weeks (
  season     integer     not null,
  week       integer     not null,
  locked_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season, week)
);
