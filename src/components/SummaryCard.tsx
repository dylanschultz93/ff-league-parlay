import { STAKE, formatAmericanOdds, formatMoney, formatProbability } from "@/lib/odds";
import type { ParlaySummary } from "@/lib/odds";

export default function SummaryCard({
  summary,
  locked,
  note,
}: {
  summary: ParlaySummary | null;
  locked: boolean;
  note?: string;
}) {
  const headline = summary ? formatAmericanOdds(summary.american) : "—";
  const { mobile, desktop } = headlineSize(headline.length);
  const payout = summary ? formatMoney(summary.payout) : "—";

  return (
    <section className="flex flex-col gap-4 rounded-[22px] border border-card-line bg-card px-5 pt-[22px] pb-[18px] lg:gap-[22px] lg:px-[26px] lg:pt-7 lg:pb-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-mono text-[11px] tracking-[0.16em] text-[#7a838b] uppercase">
          {locked ? "Final parlay" : "The parlay so far"}
        </h2>
        <p
          className={`tabular font-mono leading-none font-semibold tracking-[-0.03em] lg:tracking-[-0.035em] ${
            summary ? "text-accent" : "text-dim"
          }`}
          style={
            {
              fontSize: `${mobile}px`,
              "--headline-lg": `${desktop}px`,
            } as React.CSSProperties
          }
        >
          {headline}
        </p>
        {note && <p className="pt-1 text-sm text-muted-2">{note}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:gap-3.5">
        <Stat
          label="Decimal"
          value={summary ? summary.decimal.toFixed(2) : "—"}
          dim={!summary}
        />
        <Stat
          label="Win chance"
          value={summary ? formatProbability(summary.impliedProbability) : "—"}
          dim={!summary}
        />
      </dl>

      <div
        className={`flex items-center justify-between rounded-[14px] border px-4 py-3.5 lg:px-[18px] lg:py-4 ${
          summary
            ? "border-[var(--accent-28)] bg-[var(--accent-11)]"
            : "border-dash bg-[#181c20]"
        }`}
      >
        <span
          className={`shrink-0 font-mono text-[11px] tracking-[0.12em] whitespace-nowrap uppercase ${
            summary ? "text-accent-soft" : "text-muted-3"
          }`}
        >
          ${STAKE} pays
        </span>
        <span
          className={`tabular font-mono font-semibold tracking-[-0.02em] ${
            payout.length > 10 ? "text-[22px] lg:text-[26px]" : "text-[28px] lg:text-[34px]"
          } ${summary ? "text-accent-bright" : "text-dim"}`}
        >
          {payout}
        </span>
      </div>
    </section>
  );
}

/**
 * A long-shot parlay can reach eight digits (+11959226). Step the display size
 * down by length so the headline never overflows a 390px screen.
 */
function headlineSize(length: number): { mobile: number; desktop: number } {
  if (length <= 5) return { mobile: 68, desktop: 88 };
  if (length === 6) return { mobile: 60, desktop: 80 };
  if (length === 7) return { mobile: 52, desktop: 70 };
  if (length === 8) return { mobile: 46, desktop: 62 };
  return { mobile: 40, desktop: 54 };
}

function Stat({
  label,
  value,
  dim,
}: {
  label: string;
  value: string;
  dim: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10px] tracking-[0.12em] text-muted-3 uppercase">
        {label}
      </dt>
      <dd
        className={`tabular font-mono text-lg lg:text-xl ${
          dim ? "text-dim" : "text-[#e4e9ec]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
