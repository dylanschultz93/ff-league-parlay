import type { Metadata } from "next";
import { ResultChip } from "@/components/LegCard";
import PageShell from "@/components/PageShell";
import StatTile from "@/components/StatTile";
import WireframeNote from "@/components/WireframeNote";
import { currentSeason } from "@/lib/season";
import { STAKE, formatAmericanOdds, formatMoney } from "@/lib/odds";
import { PAST_WEEKS, type PastWeek } from "@/lib/wireframe";

export const metadata: Metadata = { title: "Past weeks" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  // Last season — the current one has nothing settled yet. Cosmetic here, so
  // a database that is down costs the label, not the screen.
  const season = await currentSeason();
  const archive = season === null ? null : season - 1;
  // Derived rather than written down: a wireframe that contradicts itself is
  // harder to read than one with nothing in it.
  const cashed = PAST_WEEKS.filter((week) => week.result === "won").length;
  const staked = PAST_WEEKS.length * STAKE;
  const returned = PAST_WEEKS.reduce((sum, week) => sum + (week.payout ?? 0), 0);
  const net = returned - staked;

  return (
    <PageShell
      title="Past weeks"
      meta={archive === null ? undefined : `${archive} Season`}
      metaShort={archive === null ? undefined : `${archive}`}
    >
      <WireframeNote>
        Every settled week, what it paid, and who covered it. The numbers below
        are made up — nothing reads the archive yet.
      </WireframeNote>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        <StatTile
          label="Record"
          value={`${cashed}–${PAST_WEEKS.length - cashed}`}
        />
        <StatTile
          label="Net"
          value={`${net >= 0 ? "+" : "−"}${formatMoney(Math.abs(net))}`}
          tone={net >= 0 ? "good" : "bad"}
        />
        <StatTile label="Staked" value={formatMoney(staked)} />
        <StatTile label="Returned" value={formatMoney(returned)} />
      </div>

      <ul className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3">
        {PAST_WEEKS.map((week) => (
          <WeekCard key={week.label} week={week} />
        ))}
      </ul>

      {season !== null && (
        <p className="font-mono text-xs text-muted-3">
          {season} weeks land here as each one settles.
        </p>
      )}
    </PageShell>
  );
}

function WeekCard({ week }: { week: PastWeek }) {
  const won = week.result === "won";

  return (
    <li
      className="flex flex-col gap-3 rounded-2xl border bg-panel p-4"
      style={{
        borderColor: won ? "var(--accent-25)" : "var(--panel-border)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs tracking-[0.1em] text-[#79828a] uppercase">
          {week.label}
        </span>
        <ResultChip result={week.result} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <span
          className={`tabular font-mono text-[30px] leading-none font-semibold tracking-[-0.02em] ${
            won ? "text-accent" : "text-settled-dim"
          }`}
        >
          {formatAmericanOdds(week.american)}
        </span>
        {/* A dead week's headline is who was out the $10; a live one's is what
            it came back with. */}
        <span className="text-right text-[13px] text-faint">
          {week.legCount} legs ·{" "}
          {won && week.payout !== null
            ? `paid ${formatMoney(week.payout)}`
            : `${week.payer} paid`}
        </span>
      </div>

      <p className="border-t border-panel-divider pt-2.5 text-[13px] text-[#69727a]">
        {week.note}
      </p>
    </li>
  );
}
