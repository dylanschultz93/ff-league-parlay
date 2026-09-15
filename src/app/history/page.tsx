import type { Metadata } from "next";
import EmptyNote from "@/components/EmptyNote";
import { ResultChip } from "@/components/LegCard";
import LoadError from "@/components/LoadError";
import PageShell from "@/components/PageShell";
import StatTile from "@/components/StatTile";
import { summarizeWeek, totalsFor, type WeekSummary } from "@/lib/archive";
import { describeDbError } from "@/lib/db";
import { formatAmericanOdds, formatMoney } from "@/lib/odds";
import type { ParlayStatus } from "@/lib/parlay";
import {
  getLeagueState,
  listArchivedWeeks,
  type LeagueState,
} from "@/lib/store";

export const metadata: Metadata = { title: "Past weeks" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  let weeks: WeekSummary[] = [];
  let state: LeagueState | null = null;
  let error: string | undefined;

  try {
    const [archived, loadedState] = await Promise.all([
      listArchivedWeeks(),
      getLeagueState(),
    ]);
    weeks = archived.map(summarizeWeek);
    state = loadedState;
  } catch (cause) {
    error = describeDbError(cause);
  }

  const totals = totalsFor(weeks);

  return (
    <PageShell
      title="Past weeks"
      meta={state === null ? undefined : `${state.season} Season`}
      metaShort={state === null ? undefined : `${state.season}`}
    >
      {error && <LoadError message={error} />}

      {!error && weeks.length === 0 && state !== null && (
        <EmptyNote>
          Nothing back here yet — week {state.week} is the week the app is on.
          It lands here with its legs, its price and whoever covered it as soon
          as the league moves on to week {state.week + 1}.
        </EmptyNote>
      )}

      {weeks.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            <StatTile label="Record" value={`${totals.won}–${totals.lost}`} />
            <StatTile
              label="Net"
              value={`${totals.net >= 0 ? "+" : "−"}${formatMoney(Math.abs(totals.net))}`}
              tone={totals.net >= 0 ? "good" : "bad"}
            />
            <StatTile label="Staked" value={formatMoney(totals.staked)} />
            <StatTile label="Returned" value={formatMoney(totals.returned)} />
          </div>

          <ul className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3">
            {weeks.map((week) => (
              <WeekCard
                key={`${week.season}-${week.week}`}
                week={week}
                season={state?.season ?? null}
              />
            ))}
          </ul>

          {totals.settledWeeks < weeks.length && (
            <p className="font-mono text-xs text-muted-3">
              {weeks.length - totals.settledWeeks} of {weeks.length} weeks never
              settled — those are left out of the money above.
            </p>
          )}
        </>
      )}
    </PageShell>
  );
}

function WeekCard({
  week,
  season,
}: {
  week: WeekSummary;
  /** The season the app is on, so older ones can name themselves. */
  season: number | null;
}) {
  const won = week.status === "won";
  const lost = week.status === "lost";
  const label =
    season === null || week.season === season
      ? `Week ${week.week}`
      : `${week.season} · Week ${week.week}`;

  return (
    <li
      className="flex flex-col gap-3 rounded-2xl border bg-panel p-4"
      style={{
        borderColor: won
          ? "var(--accent-25)"
          : lost
            ? "var(--loss-25)"
            : "var(--panel-border)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs tracking-[0.1em] text-[#79828a] uppercase">
          {label}
        </span>
        {won || lost ? (
          <ResultChip result={won ? "won" : "lost"} />
        ) : (
          <PendingChip status={week.status} />
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <span
          className={`tabular font-mono text-[30px] leading-none font-semibold tracking-[-0.02em] ${
            won ? "text-accent" : week.summary ? "text-settled-dim" : "text-dim"
          }`}
        >
          {week.summary ? formatAmericanOdds(week.summary.american) : "—"}
        </span>
        {/* A dead week's headline is who was out the $10; a live one's is what
            it came back with. */}
        <span className="text-right text-[13px] text-faint">
          {week.legCount} {week.legCount === 1 ? "leg" : "legs"} ·{" "}
          {payerLine(week)}
        </span>
      </div>

      <div className="flex flex-col gap-1 border-t border-panel-divider pt-2.5">
        <p className="text-[13px] text-[#69727a]">{week.note}</p>
        {/* Why that person was covering it. Written on the manage screen and
            otherwise only ever visible during the week it was set. */}
        {week.payer !== null && week.payerReason !== null && (
          <p className="text-[12px] text-faint-2">
            {week.payer} — {week.payerReason}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * The money half of a card's second line. Only a week that actually settled
 * has anyone out of pocket — naming a payer on a week that was never locked
 * says who was down for it, not who paid.
 */
function payerLine(week: WeekSummary): string {
  if (week.status === "won" && week.payout !== null) {
    return `paid ${formatMoney(week.payout)}`;
  }
  if (week.payer === null) return "no payer named";
  return week.status === "lost"
    ? `${week.payer} paid`
    : `${week.payer} was down for it`;
}

/** Stands in for the won/lost chip on a week that reached neither. */
function PendingChip({ status }: { status: ParlayStatus }) {
  return (
    <span className="rounded-[7px] border border-dashed border-dash px-[9px] py-[5px] font-mono text-[11px] font-semibold tracking-[0.08em] text-muted-3 uppercase">
      {status === "live" ? "Ungraded" : "Skipped"}
    </span>
  );
}
