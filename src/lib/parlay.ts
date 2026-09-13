import type { Leg } from "@/lib/store";

/**
 * Where the week's ticket stands.
 *
 * - `open`  — still collecting legs, nothing placed.
 * - `live`  — locked, some legs still ungraded.
 * - `won`   — locked and every leg came in.
 * - `lost`  — locked and at least one leg missed. A parlay pays only if all of
 *             it hits, so one loss settles the whole ticket immediately; the
 *             remaining legs don't need grading.
 */
export type ParlayStatus = "open" | "live" | "won" | "lost";

export function parlayStatus(legs: Leg[], locked: boolean): ParlayStatus {
  if (!locked) return "open";
  // An empty board can't be locked through the API, but if one ever is, it is
  // still frozen — and `every` on no legs would otherwise report a win.
  if (legs.length === 0) return "live";
  if (legs.some((leg) => leg.result === "lost")) return "lost";
  if (legs.every((leg) => leg.result === "won")) return "won";
  return "live";
}

export function settled(status: ParlayStatus): boolean {
  return status === "won" || status === "lost";
}

/** The leg that killed it — the first loser in board order. */
export function bustedOn(legs: Leg[]): Leg | null {
  return legs.find((leg) => leg.result === "lost") ?? null;
}

export function gradedCount(legs: Leg[]): number {
  return legs.filter((leg) => leg.result !== null).length;
}
