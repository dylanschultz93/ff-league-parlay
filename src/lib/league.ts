/**
 * League configuration. Placeholder values for the walking skeleton — this moves
 * into the database (or an env-backed config) once storage is wired up.
 */

export const LEAGUE = {
  name: "Parlay Pool",
  season: 2025,
  week: 3,
  /** Lowest scorer from the prior week — they put up the $10. */
  payer: "Kyle",
  roster: [
    "Dylan",
    "Kyle",
    "Marcus",
    "Ben",
    "Tyler",
    "Nate",
    "Sam",
    "Chris",
    "Alex",
    "Jordan",
  ],
} as const;

export type RosterName = (typeof LEAGUE)["roster"][number];
