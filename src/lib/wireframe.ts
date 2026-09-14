/**
 * Placeholder data for the two screens that are still wireframes.
 *
 * None of it is real and none of it is stored: nothing keeps a settled week's
 * bookkeeping or a per-person record yet. Each block dies with the screen it
 * feeds, as that screen gets wired up — the management screen took its own
 * with it.
 */

export type PastWeek = {
  /** Free text rather than a number — preseason weeks are on the record too. */
  label: string;
  result: "won" | "lost";
  american: number;
  legCount: number;
  /** Who put up the $10 that week. */
  payer: string;
  /** What a winning ticket returned, stake included. Null when it died. */
  payout: number | null;
  note: string;
};

/**
 * Newest first, which is the order the screen renders. Last season only — 2026
 * has nothing settled yet.
 */
export const PAST_WEEKS: PastWeek[] = [
  {
    label: "Week 17",
    result: "lost",
    american: 1420,
    legCount: 13,
    payer: "Chat",
    payout: null,
    note: "Died on Rush's kicker prop. Again.",
  },
  {
    label: "Week 16",
    result: "won",
    american: 860,
    legCount: 12,
    payer: "Nick",
    payout: 96,
    note: "Sandia's under carried the whole thing.",
  },
  {
    label: "Week 15",
    result: "lost",
    american: 3305,
    legCount: 14,
    payer: "DK",
    payout: null,
    note: "Two legs off. Closest we've been.",
  },
  {
    label: "Week 14",
    result: "lost",
    american: 512,
    legCount: 11,
    payer: "Mojo",
    payout: null,
    note: "Nobody read the depth chart.",
  },
];

export type ParticipantStat = {
  name: string;
  won: number;
  lost: number;
  /** Mean American odds of the legs they've submitted. */
  avgOdds: number;
  /** How many weeks they've been the one putting up the $10. */
  weeksPaid: number;
};

/** Legs add up to the leg counts in PAST_WEEKS; payers match too. */
export const PARTICIPANT_STATS: ParticipantStat[] = [
  { name: "Dylan", won: 3, lost: 1, avgOdds: 265, weeksPaid: 0 },
  { name: "Sandia", won: 3, lost: 1, avgOdds: 180, weeksPaid: 0 },
  { name: "Chris", won: 2, lost: 1, avgOdds: 310, weeksPaid: 0 },
  { name: "Parth", won: 2, lost: 1, avgOdds: 225, weeksPaid: 0 },
  { name: "Patric", won: 2, lost: 2, avgOdds: 190, weeksPaid: 0 },
  { name: "Alec", won: 2, lost: 2, avgOdds: 145, weeksPaid: 0 },
  { name: "Harrison", won: 2, lost: 2, avgOdds: 420, weeksPaid: 0 },
  { name: "Chou", won: 1, lost: 2, avgOdds: 260, weeksPaid: 0 },
  { name: "Tomas", won: 1, lost: 2, avgOdds: 205, weeksPaid: 0 },
  { name: "Nick", won: 1, lost: 3, avgOdds: 355, weeksPaid: 1 },
  { name: "Mojo", won: 1, lost: 3, avgOdds: 150, weeksPaid: 1 },
  { name: "Rush", won: 1, lost: 3, avgOdds: 610, weeksPaid: 0 },
  { name: "DK", won: 0, lost: 3, avgOdds: 240, weeksPaid: 1 },
  { name: "Chat", won: 0, lost: 3, avgOdds: 480, weeksPaid: 1 },
];
