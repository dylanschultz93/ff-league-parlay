import { formatAmericanOdds } from "@/lib/odds";
import type { Leg } from "@/lib/store";

export default function LegCard({
  leg,
  onEdit,
  onRemove,
}: {
  leg: Leg;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-panel-line bg-panel px-3.5 pt-3.5 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[0.1em] text-[#79828a] uppercase">
            {leg.name}
          </span>
          <p className="text-[15px] leading-[1.35] wrap-break-word text-ink-2 text-pretty">
            {leg.pick}
          </p>
        </div>
        <OddsChip odds={leg.odds} />
      </div>
      <div className="flex gap-4 border-t border-panel-divider pt-2">
        <button
          type="button"
          onClick={onEdit}
          className="font-mono text-[11px] text-[#69727a] transition-colors hover:text-ink-3"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="font-mono text-[11px] text-[#69727a] transition-colors hover:text-danger-text"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export function OddsChip({ odds }: { odds: number }) {
  const positive = odds > 0;
  return (
    <span
      className="tabular rounded-[9px] px-2.5 py-1.5 font-mono text-[15px] font-semibold whitespace-nowrap"
      style={{
        color: positive ? "var(--accent)" : "var(--cool)",
        background: positive ? "var(--accent-12)" : "var(--cool-13)",
      }}
    >
      {formatAmericanOdds(odds)}
    </span>
  );
}
