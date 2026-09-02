import { db, isUuid } from "@/lib/db";
import { LEAGUE } from "@/lib/league";

export type Leg = {
  id: string;
  name: string;
  pick: string;
  odds: number;
  createdAt: string;
};

export type NewLeg = Omit<Leg, "id" | "createdAt">;

type Row = {
  id: string;
  name: string;
  pick: string;
  odds: number;
  created_at: string | Date;
};

function toLeg(row: Row): Leg {
  return {
    id: row.id,
    name: row.name,
    pick: row.pick,
    odds: Number(row.odds),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Every query is scoped to the current week from LEAGUE, so past weeks stay in
 * the table untouched and are there when the history screen gets built.
 */
export async function listLegs(): Promise<Leg[]> {
  const rows = (await db()`
    select id, name, pick, odds, created_at
      from legs
     where season = ${LEAGUE.season}
       and week = ${LEAGUE.week}
     order by created_at asc
  `) as Row[];
  return rows.map(toLeg);
}

/** One leg per person: submitting again replaces that person's existing leg. */
export async function upsertLeg(input: NewLeg): Promise<Leg> {
  const rows = (await db()`
    insert into legs (season, week, name, pick, odds)
    values (${LEAGUE.season}, ${LEAGUE.week}, ${input.name}, ${input.pick}, ${input.odds})
    on conflict (season, week, lower(name))
    do update set pick = excluded.pick,
                  odds = excluded.odds,
                  updated_at = now()
    returning id, name, pick, odds, created_at
  `) as Row[];
  return toLeg(rows[0]);
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
    returning id, name, pick, odds, created_at
  `) as Row[];
  return rows[0] ? toLeg(rows[0]) : null;
}

export async function deleteLeg(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = (await db()`
    delete from legs where id = ${id}::uuid returning id
  `) as Row[];
  return rows.length > 0;
}
