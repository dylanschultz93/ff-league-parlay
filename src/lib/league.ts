/**
 * League configuration — the things that change once a week, by hand.
 *
 * The roster and the week's payer used to live here too. They're in the
 * database now, behind the management screen: see `participants` and the
 * `payer` columns on `weeks` in schema.sql. schema.sql seeds the roster with
 * the names that were here.
 */

export const LEAGUE = {
  name: "Parlay Pool",
  season: 2026,
  week: 1,
  /** Copy for the submission deadline. Cosmetic — nothing enforces it yet. */
  locksAt: "locks Sunday 1:00",
};
