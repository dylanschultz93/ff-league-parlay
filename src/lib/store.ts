import { randomUUID } from "node:crypto";

export type Leg = {
  id: string;
  name: string;
  pick: string;
  odds: number;
  createdAt: string;
};

export type NewLeg = Omit<Leg, "id" | "createdAt">;

/**
 * In-memory store for the walking skeleton.
 *
 * NOTE: this does not survive a server restart, and on Vercel each serverless
 * instance gets its own copy — so legs will appear to come and go in
 * production. Swapping this file for a real datastore (Neon Postgres, Upstash)
 * is the next step; the API routes only depend on the exported functions below.
 *
 * Held on globalThis so the server-component render and the route handlers share
 * one instance — in dev they are separate module graphs and would otherwise each
 * get their own empty Map.
 */
const globalStore = globalThis as typeof globalThis & {
  __parlayLegs?: Map<string, Leg>;
};
const legs = (globalStore.__parlayLegs ??= new Map<string, Leg>());

export function listLegs(): Leg[] {
  return [...legs.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export function findLegByName(name: string): Leg | undefined {
  return [...legs.values()].find(
    (leg) => leg.name.toLowerCase() === name.toLowerCase(),
  );
}

/** One leg per person: submitting again replaces that person's existing leg. */
export function upsertLeg(input: NewLeg): Leg {
  const existing = findLegByName(input.name);
  const leg: Leg = {
    id: existing?.id ?? randomUUID(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    ...input,
  };
  legs.set(leg.id, leg);
  return leg;
}

export function updateLeg(id: string, input: Partial<NewLeg>): Leg | null {
  const existing = legs.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...input };
  legs.set(id, updated);
  return updated;
}

export function deleteLeg(id: string): boolean {
  return legs.delete(id);
}
