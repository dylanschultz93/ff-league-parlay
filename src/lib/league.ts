/**
 * League configuration. Still hardcoded — moves into the database along with
 * the legs once storage is wired up.
 */

export const LEAGUE = {
  name: "Parlay Pool",
  season: 2025,
  week: 3,
  /** Copy for the submission deadline. Cosmetic — nothing enforces it yet. */
  locksAt: "locks Sunday 1:00",
  /**
   * Lowest scorer from the prior week — they put up the $10. Set to null when
   * it isn't settled yet and the callout hides itself.
   */
  payer: null as string | null,
  roster: [
    "Dylan",
    "Chris",
    "Chat",
    "Rush",
    "Patric",
    "Sandia",
    "Chou",
    "Mojo",
    "Parth",
    "Nick",
    "Tomas",
    "Alec",
    "Harrison",
    "DK",
  ],
};
