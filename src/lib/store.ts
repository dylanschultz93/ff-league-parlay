import { db, isUuid } from "@/lib/db";

/** How a leg finished. Null until the parlay is locked and someone grades it. */
export type LegResult = "won" | "lost";

export type Leg = {
  id: string;
  name: string;
  pick: string;
  odds: number;
  result: LegResult | null;
  createdAt: string;
};

export type NewLeg = Omit<Leg, "id" | "result" | "createdAt">;

/** The week's parlay: open until it's locked, then graded leg by leg. */
export type Parlay = {
  locked: boolean;
  lockedAt: string | null;
  /** Who's putting up the $10 this week, and why. Null until it's settled. */
  payer: string | null;
  payerReason: string | null;
};

const OPEN: Parlay = {
  locked: false,
  lockedAt: null,
  payer: null,
  payerReason: null,
};

/** Someone who can put a leg on the ticket. */
export type Participant = {
  id: string;
  name: string;
  /** Benched people keep their legs but drop off the week's waiting list. */
  active: boolean;
};

type Row = {
  id: string;
  name: string;
  pick: string;
  odds: number;
  result: string | null;
  created_at: string | Date;
};

function toLeg(row: Row): Leg {
  return {
    id: row.id,
    name: row.name,
    pick: row.pick,
    odds: Number(row.odds),
    result: (row.result as LegResult | null) ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Every query is scoped to the current week from `league_state`, so past weeks
 * stay in the table untouched and are there when the history screen gets built.
 */
export async function listLegs(): Promise<Leg[]> {
  const rows = (await db()`
    select id, name, pick, odds, result, created_at
      from legs
     where (season, week) = (select season, week from league_state)
     order by created_at asc
  `) as Row[];
  return rows.map(toLeg);
}

type WeekRow = {
  locked_at: string | Date | null;
  payer: string | null;
  payer_reason: string | null;
};

export async function getParlay(): Promise<Parlay> {
  const rows = (await db()`
    select locked_at, payer, payer_reason
      from weeks
     where (season, week) = (select season, week from league_state)
  `) as WeekRow[];
  return toParlay(rows[0]);
}

/**
 * A week row now appears as soon as anyone names a payer, so its existence no
 * longer means the parlay is locked — only `locked_at` does.
 */
function toParlay(row: WeekRow | undefined): Parlay {
  if (!row) return OPEN;
  return {
    locked: row.locked_at !== null,
    lockedAt: row.locked_at ? new Date(row.locked_at).toISOString() : null,
    payer: row.payer,
    payerReason: row.payer_reason,
  };
}

/**
 * Name who's covering the ticket, or pass null to take it back off them. The
 * upsert mirrors lockParlay's: whoever writes to the week first creates it.
 */
export async function setPayer(
  payer: string | null,
  payerReason: string | null,
): Promise<Parlay> {
  const rows = (await db()`
    insert into weeks (season, week, payer, payer_reason)
    select season, week, ${payer}, ${payerReason} from league_state
    on conflict (season, week)
    do update set payer = excluded.payer,
                  payer_reason = excluded.payer_reason,
                  updated_at = now()
    returning locked_at, payer, payer_reason
  `) as WeekRow[];
  return toParlay(rows[0]);
}

/**
 * Lock the week's parlay. Idempotent — re-locking keeps the original time, so
 * two people hitting the button don't move the timestamp.
 */
export async function lockParlay(): Promise<Parlay> {
  const rows = (await db()`
    insert into weeks (season, week, locked_at)
    select season, week, now() from league_state
    on conflict (season, week)
    do update set locked_at = coalesce(weeks.locked_at, now()),
                  updated_at = now()
    returning locked_at, payer, payer_reason
  `) as WeekRow[];
  return toParlay(rows[0]);
}

/**
 * Undo a lock. Only while nothing has been graded — once results are in, the
 * week is a record of what happened, not a draft. The `not exists` clause is
 * what enforces that; null back means it was refused, and the caller works out
 * which reason to report.
 */
export async function unlockParlay(): Promise<Parlay | null> {
  const rows = (await db()`
    update weeks
       set locked_at = null,
           updated_at = now()
     where (season, week) = (select season, week from league_state)
       and not exists (
             select 1
               from legs
              where legs.season = weeks.season
                and legs.week = weeks.week
                and legs.result is not null
           )
    returning locked_at, payer, payer_reason
  `) as WeekRow[];
  return rows[0] ? toParlay(rows[0]) : null;
}

/**
 * One leg per person: submitting again replaces that person's existing leg.
 * Returns null once the parlay is locked — the `where not exists` guard is
 * atomic, so a lock landing mid-request can't let a late leg through.
 */
export async function upsertLeg(input: NewLeg): Promise<Leg | null> {
  const rows = (await db()`
    insert into legs (season, week, name, pick, odds)
    select ls.season, ls.week, ${input.name}, ${input.pick}, ${input.odds}
      from league_state ls
     where not exists (
             select 1
               from weeks
              where (weeks.season, weeks.week) = (ls.season, ls.week)
                and weeks.locked_at is not null
           )
    on conflict (season, week, lower(name))
    do update set pick = excluded.pick,
                  odds = excluded.odds,
                  updated_at = now()
    returning id, name, pick, odds, result, created_at
  `) as Row[];
  return rows[0] ? toLeg(rows[0]) : null;
}

export async function updateLeg(
  id: string,
  patch: Partial<NewLeg>,
): Promise<Leg | null> {
  if (!isUuid(id)) return null;
  const rows = (await db()`
    update legs
       set pick = coalesce(${patch.pick ?? null}::text, pick),
           odds = coalesce(${patch.odds ?? null}::integer, odds),
           updated_at = now()
     where id = ${id}::uuid
       and not exists (
             select 1
               from weeks
              where weeks.season = legs.season
                and weeks.week = legs.week
                and weeks.locked_at is not null
           )
    returning id, name, pick, odds, result, created_at
  `) as Row[];
  return rows[0] ? toLeg(rows[0]) : null;
}

/**
 * Grade a leg, or pass null to put it back to ungraded. Only while the parlay
 * is locked: before that the legs are still being edited, so a result would be
 * grading a bet nobody has placed.
 */
export async function setLegResult(
  id: string,
  result: LegResult | null,
): Promise<Leg | null> {
  if (!isUuid(id)) return null;
  const rows = (await db()`
    update legs
       set result = ${result}::text,
           updated_at = now()
     where id = ${id}::uuid
       and exists (
             select 1
               from weeks
              where weeks.season = legs.season
                and weeks.week = legs.week
                and weeks.locked_at is not null
           )
    returning id, name, pick, odds, result, created_at
  `) as Row[];
  return rows[0] ? toLeg(rows[0]) : null;
}

export async function deleteLeg(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = (await db()`
    delete from legs
     where id = ${id}::uuid
       and not exists (
             select 1
               from weeks
              where weeks.season = legs.season
                and weeks.week = legs.week
                and weeks.locked_at is not null
           )
    returning id
  `) as Row[];
  return rows.length > 0;
}

/* -- The current week --------------------------------------------------- */

/**
 * Which week the app is on. Set by hand on /manage — see the `league_state`
 * table, which every week-scoped query above reads.
 */
export type LeagueState = { season: number; week: number };

type StateRow = { season: number; week: number };

const toState = (row: StateRow): LeagueState => ({
  season: Number(row.season),
  week: Number(row.week),
});

export async function getLeagueState(): Promise<LeagueState> {
  const rows = (await db()`
    select season, week from league_state
  `) as StateRow[];
  // schema.sql seeds this row. An empty table means the schema never applied,
  // and saying so beats every week-scoped query quietly matching nothing.
  if (!rows[0]) {
    throw new Error(
      "No league_state row — apply schema.sql with `npm run db:init`.",
    );
  }
  return toState(rows[0]);
}

/**
 * Move the app to a week. Everything else follows from this: the board, the
 * payer, and which week a submitted leg lands on. Past weeks keep their rows.
 */
export async function setLeagueState(
  season: number,
  week: number,
): Promise<LeagueState> {
  const rows = (await db()`
    insert into league_state (season, week)
    values (${season}, ${week})
    on conflict (id)
    do update set season = excluded.season,
                  week = excluded.week,
                  updated_at = now()
    returning season, week
  `) as StateRow[];
  return toState(rows[0]);
}

/* -- Participants ------------------------------------------------------- */

type ParticipantRow = { id: string; name: string; active: boolean };

/**
 * Everyone on the list, benched included — the management screen shows both,
 * and the board filters to the active ones. Ordered by name because that is
 * how both screens read it; nothing depends on the order they were added in.
 */
export async function listParticipants(): Promise<Participant[]> {
  const rows = (await db()`
    select id, name, active
      from participants
     order by lower(name)
  `) as ParticipantRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
  }));
}

/** Returns null when that name is already on the list, whatever its case. */
export async function addParticipant(
  name: string,
): Promise<Participant | null> {
  const rows = (await db()`
    insert into participants (name)
    values (${name})
    on conflict (lower(name)) do nothing
    returning id, name, active
  `) as ParticipantRow[];
  return rows[0] ?? null;
}

export async function setParticipantActive(
  id: string,
  active: boolean,
): Promise<Participant | null> {
  if (!isUuid(id)) return null;
  const rows = (await db()`
    update participants
       set active = ${active},
           updated_at = now()
     where id = ${id}::uuid
    returning id, name, active
  `) as ParticipantRow[];
  return rows[0] ?? null;
}

/**
 * Why a removal didn't happen. `has-leg` is the interesting one: legs are
 * keyed by name, not by a foreign key, so dropping someone mid-week would
 * leave a leg on the board belonging to nobody. Bench them instead, or take
 * the leg off first.
 */
export type RemoveOutcome = "removed" | "has-leg" | "missing";

export async function removeParticipant(id: string): Promise<RemoveOutcome> {
  if (!isUuid(id)) return "missing";
  const rows = (await db()`
    delete from participants
     where id = ${id}::uuid
       and not exists (
             select 1
               from legs
              where (legs.season, legs.week)
                      = (select season, week from league_state)
                and lower(legs.name) = lower(participants.name)
           )
    returning id
  `) as { id: string }[];
  if (rows.length > 0) return "removed";

  // Nothing came back, which is either of the two `where` clauses. Ask which.
  const still = (await db()`
    select 1 from participants where id = ${id}::uuid
  `) as unknown[];
  return still.length > 0 ? "has-leg" : "missing";
}
