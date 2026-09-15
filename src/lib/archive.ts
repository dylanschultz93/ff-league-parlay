import {
  STAKE,
  americanToDecimal,
  decimalToAmerican,
  summarizeParlay,
  type ParlaySummary,
} from "@/lib/odds";
import {
  bustedOn,
  gradedCount,
  parlayStatus,
  settled,
  type ParlayStatus,
} from "@/lib/parlay";
import type { ArchivedWeek, PersonLeg, PersonRecord } from "@/lib/store";

/**
 * Turning stored weeks and legs into the two screens that look backwards.
 *
 * The store hands back rows; this works out what they mean. Nothing here
 * queries, so the rules about what counts as a win, what was staked, and who
 * has the better record live in one readable place rather than inside SQL.
 */

/* -- Past weeks --------------------------------------------------------- */

export type WeekSummary = {
  season: number;
  week: number;
  status: ParlayStatus;
  /** Null on a week nobody put a leg on. */
  summary: ParlaySummary | null;
  legCount: number;
  payer: string | null;
  payerReason: string | null;
  /** What the ticket actually returned. Null unless it won. */
  payout: number | null;
  note: string;
};

export function summarizeWeek(week: ArchivedWeek): WeekSummary {
  const status = parlayStatus(week.legs, week.locked);
  const summary = summarizeParlay(week.legs.map((leg) => leg.odds));
  return {
    season: week.season,
    week: week.week,
    status,
    summary,
    legCount: week.legs.length,
    payer: week.payer,
    payerReason: week.payerReason,
    // A parlay pays on the whole ticket or not at all, so anything short of a
    // win returns nothing — including a week still waiting on a grade.
    payout: status === "won" && summary ? summary.payout : null,
    note: noteFor(week, status),
  };
}

const legs = (count: number) => `${count} ${count === 1 ? "leg" : "legs"}`;

/** The line under the card: what happened, in the fewest words that say it. */
function noteFor(week: ArchivedWeek, status: ParlayStatus): string {
  const count = week.legs.length;

  if (status === "won") return `Every one of ${legs(count)} hit.`;
  if (status === "lost") {
    const busted = bustedOn(week.legs);
    return busted
      ? `Died on ${busted.name}'s leg — ${busted.pick}`
      : "Lost the ticket.";
  }
  if (status === "live") {
    return count === 0
      ? "Locked with an empty board."
      : `Locked, ${gradedCount(week.legs)} of ${count} graded.`;
  }
  // Open, and the app has already moved past it: the week was skipped. Worth
  // saying plainly — the legs are on the record but no ticket was ever placed.
  return count === 0
    ? "Nothing was ever put on this week."
    : `Never locked — ${legs(count)} on the record, no ticket placed.`;
}

export type ArchiveTotals = {
  /** Weeks that actually resolved. The rest were never staked. */
  settledWeeks: number;
  won: number;
  lost: number;
  staked: number;
  returned: number;
  net: number;
};

/**
 * Money only counts from weeks that settled: a week that was skipped, or one
 * still waiting on a grade, never had $10 on it, and folding those into the
 * stake would show a loss the league never took.
 */
export function totalsFor(weeks: WeekSummary[]): ArchiveTotals {
  const decided = weeks.filter((week) => settled(week.status));
  const won = decided.filter((week) => week.status === "won").length;
  const returned = decided.reduce((sum, week) => sum + (week.payout ?? 0), 0);
  const staked = decided.length * STAKE;

  return {
    settledWeeks: decided.length,
    won,
    lost: decided.length - won,
    staked,
    returned,
    net: returned - staked,
  };
}

/* -- Per-person records ------------------------------------------------- */

export type PersonStat = {
  name: string;
  active: boolean | null;
  won: number;
  lost: number;
  /** Legs with a result. The denominator of the hit rate. */
  graded: number;
  /** Every leg submitted, graded or not, newest week first. */
  legs: PersonLeg[];
  legCount: number;
  hitRate: number;
  /** Null until they've put up a leg. */
  avgOdds: number | null;
  longestOdds: number | null;
  weeksPaid: number;
};

export function statFor(record: PersonRecord): PersonStat {
  const won = record.legs.filter((leg) => leg.result === "won").length;
  const lost = record.legs.filter((leg) => leg.result === "lost").length;
  const odds = record.legs.map((leg) => leg.odds);
  const graded = won + lost;

  return {
    name: record.name,
    active: record.active,
    won,
    lost,
    graded,
    legs: record.legs,
    legCount: record.legs.length,
    hitRate: graded === 0 ? 0 : won / graded,
    avgOdds: meanOdds(odds),
    longestOdds: odds.reduce<number | null>(
      (longest, next) =>
        longest === null || americanToDecimal(next) > americanToDecimal(longest)
          ? next
          : longest,
      null,
    ),
    weeksPaid: record.weeksPaid,
  };
}

/**
 * American odds don't average: +100 and −100 are the same price, so their mean
 * reads as 0, which isn't a price at all. Averaging the decimal form and
 * converting back keeps the answer on the scale the number is read on.
 */
function meanOdds(all: number[]): number | null {
  if (all.length === 0) return null;
  const mean =
    all.reduce((sum, odds) => sum + americanToDecimal(odds), 0) / all.length;
  return decimalToAmerican(mean);
}

/** The sort chips on the stats screen, in the order they're shown. */
export const SORTS = {
  "hit-rate": "Hit rate",
  legs: "Legs",
  longest: "Longest odds",
  name: "Name",
} as const;

export type SortKey = keyof typeof SORTS;

export const DEFAULT_SORT: SortKey = "hit-rate";

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && value in SORTS;
}

const byName = (a: PersonStat, b: PersonStat) => a.name.localeCompare(b.name);

/** Longest price, on the decimal scale so +200 and −110 compare properly. */
const reach = (odds: number | null) => (odds === null ? 0 : americanToDecimal(odds));

export function rank(people: PersonStat[], sort: SortKey): PersonStat[] {
  const ranked = [...people];

  switch (sort) {
    case "legs":
      return ranked.sort((a, b) => b.legCount - a.legCount || byName(a, b));
    case "longest":
      return ranked.sort(
        (a, b) => reach(b.longestOdds) - reach(a.longestOdds) || byName(a, b),
      );
    case "name":
      return ranked.sort(byName);
    default:
      // Anyone with nothing graded sorts last whatever the division says: a
      // hit rate of 0 out of 0 is an absence of a record, not a bad one.
      return ranked.sort(
        (a, b) =>
          Number(b.graded > 0) - Number(a.graded > 0) ||
          b.hitRate - a.hitRate ||
          b.won - a.won ||
          byName(a, b),
      );
  }
}
