import { db, isUuid } from "@/lib/db";
import { LEAGUE } from "@/lib/league";

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
};

const OPEN: Parlay = { locked: false, lockedAt: null };

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
 * Every query is scoped to the current week from LEAGUE, so past weeks stay in
 * the table untouched and are there when the history screen gets built.
 */
export async function listLegs(): Promise<Leg[]> {
  const rows = (await db()`
    select id, name, pick, odds, result, created_at
      from legs
     where season = ${LEAGUE.season}
       and week = ${LEAGUE.week}
     order by created_at asc
  `) as Row[];
  return rows.map(toLeg);
}

export async function getParlay(): Promise<Parlay> {
  const rows = (await db()`
    select locked_at
      from weeks
     where season = ${LEAGUE.season}
       and week = ${LEAGUE.week}
  `) as { locked_at: string | Date | null }[];
  return toParlay(rows[0]?.locked_at ?? null);
}

function toParlay(lockedAt: string | Date | null): Parlay {
  if (!lockedAt) return OPEN;
  return { locked: true, lockedAt: new Date(lockedAt).toISOString() };
}

/**
 * Lock the week's parlay. Idempotent — re-locking keeps the original time, so
 * two people hitting the button don't move the timestamp.
 */
export async function lockParlay(): Promise<Parlay> {
  const rows = (await db()`
    insert into weeks (season, week, locked_at)
    values (${LEAGUE.season}, ${LEAGUE.week}, now())
    on conflict (season, week)
    do update set locked_at = coalesce(weeks.locked_at, now()),
                  updated_at = now()
    returning locked_at
  `) as { locked_at: string | Date }[];
  return toParlay(rows[0].locked_at);
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
     where season = ${LEAGUE.season}
       and week = ${LEAGUE.week}
       and not exists (
             select 1
               from legs
              where legs.season = weeks.season
                and legs.week = weeks.week
                and legs.result is not null
           )
    returning locked_at
  `) as { locked_at: string | Date | null }[];
  return rows[0] ? toParlay(rows[0].locked_at) : null;
}

/**
 * One leg per person: submitting again replaces that person's existing leg.
 * Returns null once the parlay is locked — the `where not exists` guard is
 * atomic, so a lock landing mid-request can't let a late leg through.
 */
export async function upsertLeg(input: NewLeg): Promise<Leg | null> {
  const rows = (await db()`
    insert into legs (season, week, name, pick, odds)
    select ${LEAGUE.season}, ${LEAGUE.week}, ${input.name}, ${input.pick}, ${input.odds}
     where not exists (
             select 1
               from weeks
              where season = ${LEAGUE.season}
                and week = ${LEAGUE.week}
                and locked_at is not null
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
