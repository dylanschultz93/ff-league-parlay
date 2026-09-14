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

-- Who's covering the $10 this week, and why. Null until someone settles it on
-- the management screen. A week row can now exist before the parlay is locked,
-- so "no row" and "locked_at is null" both still mean open.
alter table weeks
  add column if not exists payer text;
alter table weeks
  add column if not exists payer_reason text;

-- Everyone who can put a leg on the ticket. This list started hardcoded in
-- src/lib/league.ts; it lives here so the management screen can change it.
create table if not exists participants (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  -- Benched: off the week's waiting list, but their legs stay on the record
  -- and they can be brought back.
  active     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive, to match legs_one_per_person: if "dylan" and "Dylan" are
-- one person there, they have to be one person here.
create unique index if not exists participants_name
  on participants (lower(name));

-- One-time seed: the league as it stood when the roster moved out of
-- src/lib/league.ts. Guarded twice over, since this file re-runs on every
-- deploy and on the first query of every cold start — it does nothing once
-- anyone is on the list, and `on conflict` covers two instances arriving here
-- at the same moment.
insert into participants (name)
select seed.name
  from (values ('Dylan'), ('Chris'), ('Chat'), ('Rush'), ('Patric'),
               ('Sandia'), ('Chou'), ('Mojo'), ('Parth'), ('Nick'),
               ('Tomas'), ('Alec'), ('Harrison'), ('DK')) as seed(name)
 where not exists (select 1 from participants)
    on conflict (lower(name)) do nothing;
