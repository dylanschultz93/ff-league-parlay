/**
 * American odds math.
 *
 * American odds are integers with |odds| >= 100. Positive odds are the profit on
 * a $100 stake; negative odds are the stake required to profit $100.
 */

export const STAKE = 10;

export function isValidAmericanOdds(odds: number): boolean {
  return Number.isInteger(odds) && Math.abs(odds) >= 100;
}

/** Parse user input like "+150", "-110", "150". Returns null if unusable. */
export function parseAmericanOdds(input: string): number | null {
  const trimmed = input.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return null;
  const odds = Number(trimmed);
  return isValidAmericanOdds(odds) ? odds : null;
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function americanToDecimal(odds: number): number {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / -odds;
}

export function decimalToAmerican(decimal: number): number {
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1));
}

export type ParlaySummary = {
  legCount: number;
  decimal: number;
  american: number;
  impliedProbability: number;
  /** Total returned on a winning ticket, stake included. */
  payout: number;
  profit: number;
};

export function summarizeParlay(
  allOdds: number[],
  stake: number = STAKE,
): ParlaySummary | null {
  if (allOdds.length === 0) return null;
  const decimal = allOdds.reduce((acc, o) => acc * americanToDecimal(o), 1);
  return {
    legCount: allOdds.length,
    decimal,
    american: decimalToAmerican(decimal),
    impliedProbability: 1 / decimal,
    payout: stake * decimal,
    profit: stake * (decimal - 1),
  };
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function formatProbability(p: number): string {
  const pct = p * 100;
  return `${pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}%`;
}
