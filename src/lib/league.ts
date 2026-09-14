/**
 * What's left of the league in code.
 *
 * The roster, the week's payer, and the current week are all in the database
 * now, behind the management screen: `participants`, the `payer` columns on
 * `weeks`, and `league_state`. Nothing here changes week to week.
 */

export const LEAGUE = {
  name: "Parlay Pool",
  /** Copy for the submission deadline. Cosmetic — nothing enforces it yet. */
  locksAt: "locks Sunday 1:00",
};
