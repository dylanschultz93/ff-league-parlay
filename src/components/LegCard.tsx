import { formatAmericanOdds } from "@/lib/odds";
import type { Leg, LegResult } from "@/lib/store";

/**
 * One person's leg. Before the lock the footer edits it; after the lock the
 * leg is frozen and the footer grades it instead.
 */
export default function LegCard({
  leg,
  locked,
  onEdit,
  onRemove,
  onGrade,
}: {
  leg: Leg;
  locked: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onGrade: (result: LegResult | null) => void;
}) {
  const lost = leg.result === "lost";
  const won = leg.result === "won";

  return (
    <li
      className="flex flex-col gap-2 rounded-2xl border bg-panel px-3.5 pt-3.5 pb-3"
      style={{
        borderColor: won
          ? "var(--accent-25)"
          : lost
            ? "var(--loss-25)"
            : "var(--panel-border)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[0.1em] text-[#79828a] uppercase">
            {leg.name}
          </span>
          <p
            className={`text-[15px] leading-[1.35] wrap-break-word text-pretty ${
              lost ? "text-muted-2 line-through decoration-[var(--loss-40)]" : "text-ink-2"
            }`}
          >
            {leg.pick}
          </p>
        </div>
        <OddsChip odds={leg.odds} muted={lost} />
      </div>

      <div className="flex items-center gap-4 border-t border-panel-divider pt-2">
        {!locked ? (
          <>
            <FooterButton onClick={onEdit} label="Edit" />
            <FooterButton onClick={onRemove} label="Remove" danger />
          </>
        ) : leg.result ? (
          <>
            <ResultChip result={leg.result} />
            <FooterButton onClick={() => onGrade(null)} label="Clear" />
          </>
        ) : (
          <>
            <FooterButton onClick={() => onGrade("won")} label="Mark won" />
            <FooterButton onClick={() => onGrade("lost")} label="Mark lost" danger />
          </>
        )}
      </div>
    </li>
  );
}

function FooterButton({
  onClick,
  label,
  danger,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono text-[11px] text-[#69727a] transition-colors ${
        danger ? "hover:text-danger-text" : "hover:text-ink-3"
      }`}
    >
      {label}
    </button>
  );
}

/** Won/Lost badge, per the settled cards on artboard 1e. */
export function ResultChip({ result }: { result: LegResult }) {
  const won = result === "won";
  return (
    <span
      className="rounded-[7px] px-[9px] py-[5px] font-mono text-[11px] font-semibold tracking-[0.08em] uppercase"
      style={{
        color: won ? "var(--accent)" : "var(--loss)",
        background: won ? "var(--accent-14)" : "var(--loss-12)",
      }}
    >
      {won ? "Won" : "Lost"}
    </span>
  );
}

export function OddsChip({ odds, muted }: { odds: number; muted?: boolean }) {
  const positive = odds > 0;
  return (
    <span
      className="tabular rounded-[9px] px-2.5 py-1.5 font-mono text-[15px] font-semibold whitespace-nowrap"
      style={{
        color: muted
          ? "var(--muted-3)"
          : positive
            ? "var(--accent)"
            : "var(--cool)",
        background: muted
          ? "var(--track)"
          : positive
            ? "var(--accent-12)"
            : "var(--cool-13)",
      }}
    >
      {formatAmericanOdds(odds)}
    </span>
  );
}
