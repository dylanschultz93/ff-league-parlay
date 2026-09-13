import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import StatTile from "@/components/StatTile";
import WireframeNote from "@/components/WireframeNote";
import { LEAGUE } from "@/lib/league";
import { formatAmericanOdds } from "@/lib/odds";
import { PARTICIPANT_STATS, PAST_WEEKS, type ParticipantStat } from "@/lib/wireframe";

export const metadata: Metadata = { title: "Stats" };

/** How the list is ordered. Only the first one does anything so far. */
const SORTS = ["Hit rate", "Legs", "Longest odds", "Name"];

function legs(person: ParticipantStat): number {
  return person.won + person.lost;
}

function hitRate(person: ParticipantStat): number {
  const total = legs(person);
  return total === 0 ? 0 : person.won / total;
}

export default function StatsPage() {
  const ranked = [...PARTICIPANT_STATS].sort(
    (a, b) =>
      hitRate(b) - hitRate(a) ||
      b.won - a.won ||
      a.name.localeCompare(b.name),
  );

  const totalLegs = PARTICIPANT_STATS.reduce((sum, p) => sum + legs(p), 0);
  const totalWon = PARTICIPANT_STATS.reduce((sum, p) => sum + p.won, 0);

  return (
    <PageShell
      title="Stats"
      meta={`${LEAGUE.season - 1} Season`}
      metaShort={`${LEAGUE.season - 1}`}
    >
      <WireframeNote>
        Who actually hits their leg. Made-up numbers — nothing tallies a
        per-person record yet.
      </WireframeNote>

      <div className="grid grid-cols-3 gap-2.5 lg:gap-3">
        <StatTile label="Legs" value={`${totalLegs}`} />
        <StatTile
          label="Hit rate"
          value={`${Math.round((totalWon / totalLegs) * 100)}%`}
        />
        <StatTile label="Weeks" value={`${PAST_WEEKS.length}`} />
      </div>

      {/* Chips, not buttons: there is nothing behind them to press yet. */}
      <div className="flex flex-col gap-2">
        <span className="pl-0.5 font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
          Sort by
        </span>
        <div className="flex flex-wrap gap-2">
          {SORTS.map((sort, i) => (
            <span
              key={sort}
              className={`rounded-full px-3.5 py-2 font-mono text-[11px] ${
                i === 0
                  ? "border border-[var(--accent-28)] bg-[var(--accent-11)] text-accent-soft"
                  : "border border-dashed border-dash text-muted-3"
              }`}
            >
              {sort}
            </span>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-2.5">
        {ranked.map((person, i) => (
          <PersonRow key={person.name} person={person} rank={i + 1} />
        ))}
      </ul>
    </PageShell>
  );
}

function PersonRow({
  person,
  rank,
}: {
  person: ParticipantStat;
  rank: number;
}) {
  const pct = Math.round(hitRate(person) * 100);

  return (
    <li className="flex items-center gap-3.5 rounded-2xl border border-panel-line bg-panel px-3.5 py-3">
      <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#20252a] font-mono text-[11px] font-semibold text-[#b9c2c8]">
        {rank}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[15px] text-ink-2">{person.name}</span>
          <span className="tabular shrink-0 font-mono text-sm font-semibold text-ink-3">
            {person.won}–{person.lost}
          </span>
        </div>

        <div
          className="h-[5px] w-full overflow-hidden rounded-[3px]"
          style={{ background: "var(--track)" }}
        >
          <div
            className="h-full rounded-[3px]"
            style={{
              width: `${pct}%`,
              background: pct >= 50 ? "var(--accent)" : "var(--loss)",
            }}
          />
        </div>

        <span className="tabular font-mono text-[11px] text-muted-3">
          {pct}% hit · avg {formatAmericanOdds(person.avgOdds)} ·{" "}
          {person.weeksPaid === 0
            ? "never paid"
            : `paid ${person.weeksPaid}×`}
        </span>
      </div>
    </li>
  );
}
