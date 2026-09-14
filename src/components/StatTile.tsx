/**
 * One number in a panel. The summary strips on the history and stats screens
 * are both rows of these.
 */
export default function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-panel-line bg-panel p-3.5 lg:p-4">
      <span className="font-mono text-[10px] tracking-[0.12em] text-muted-3 uppercase">
        {label}
      </span>
      <span
        className={`tabular font-mono text-[22px] font-semibold ${
          tone === "good"
            ? "text-accent"
            : tone === "bad"
              ? "text-loss"
              : "text-ink-2"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
