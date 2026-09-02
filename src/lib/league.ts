/**
 * League configuration. Still hardcoded — moves into the database along with
 * the legs once storage is wired up.
 */

export const LEAGUE = {
  name: "Parlay Pool",
  season: 2026,
  week: 1,
  /** Copy for the submission deadline. Cosmetic — nothing enforces it yet. */
  locksAt: "locks Sunday 1:00",
  /**
   * Who's putting up the $10, and why. Normally last week's low scorer; in
   * Week 1 it falls to whoever finished last the previous season. Set payer to
   * null when it isn't settled and the callout hides itself.
   */
  payer: "Chat" as string | null,
  payerReason: "Finished last in 2025. Rough.",
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
