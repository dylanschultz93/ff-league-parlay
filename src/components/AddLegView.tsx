"use client";

import { useState } from "react";
import {
  STAKE,
  formatAmericanOdds,
  formatMoney,
  parseAmericanOdds,
  summarizeParlay,
} from "@/lib/odds";
import type { Leg } from "@/lib/store";

/**
 * Full-screen submission view (artboards 1c / 1d). Doubles as the edit view —
 * when `editing` is set the name is fixed and that leg's odds are excluded from
 * the "what this does" comparison.
 */
export default function AddLegView({
  roster,
  submittedNames,
  legs,
  week,
  editing,
  pending,
  onCancel,
  onSubmit,
}: {
  roster: string[];
  submittedNames: string[];
  legs: Leg[];
  week: number;
  editing: Leg | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (name: string, pick: string, odds: number) => Promise<boolean>;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [pick, setPick] = useState(editing?.pick ?? "");
  const [oddsInput, setOddsInput] = useState(
    editing ? formatAmericanOdds(editing.odds) : "",
  );

  const dirty = oddsInput.trim() !== "";
  const odds = parseAmericanOdds(oddsInput);
  const oddsInvalid = dirty && odds === null;

  const otherOdds = legs
    .filter((leg) => leg.id !== editing?.id)
    .map((leg) => leg.odds);
  const before = summarizeParlay(otherOdds);
  const after = odds === null ? null : summarizeParlay([...otherOdds, odds]);

  const canSubmit = name !== "" && pick.trim() !== "" && odds !== null && !pending;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-app lg:items-center lg:justify-center lg:bg-black/70 lg:p-6">
      <div className="flex min-h-0 flex-1 flex-col lg:h-auto lg:max-h-full lg:w-[430px] lg:flex-none lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-card-line lg:bg-app">
        <header className="flex items-center justify-between border-b border-hairline px-5 pt-[22px] pb-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="font-mono text-[13px] text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <h1 className="text-base font-semibold text-ink">
            {editing ? "Edit your leg" : "Your leg"}
          </h1>
          <span className="font-mono text-[13px] text-[#3a4147]">
            Week {week}
          </span>
        </header>

        <form
          id="add-leg"
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pt-[22px] pb-6"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!canSubmit || odds === null) return;
            await onSubmit(name, pick, odds);
          }}
        >
          <Field label="Who's this">
            <div className="relative">
              <select
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={editing !== null}
                required
                className="w-full appearance-none rounded-[14px] border border-input-line bg-card px-4 py-4 text-base text-ink-2 disabled:opacity-70"
              >
                <option value="" disabled>
                  Pick your name
                </option>
                {roster.map((option) => (
                  <option key={option} value={option}>
                    {option}
                    {!editing && submittedNames.includes(option)
                      ? " — replaces their leg"
                      : ""}
                  </option>
                ))}
              </select>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-muted-2"
              >
                ▾
              </span>
            </div>
          </Field>

          <Field
            label="The pick"
            hint={'e.g. "Bills -3.5" · "Mahomes 2+ passing TDs"'}
          >
            <textarea
              value={pick}
              onChange={(event) => setPick(event.target.value)}
              rows={3}
              placeholder="CMC over 92.5 rushing yards"
              className="min-h-[88px] w-full resize-none rounded-[14px] border bg-card px-4 py-4 text-base leading-[1.4] text-ink-2 placeholder:text-faint"
              style={{
                borderColor: pick.trim()
                  ? "var(--accent-50)"
                  : "var(--input-border)",
              }}
            />
          </Field>

          <Field
            label="American odds"
            hint={
              oddsInvalid
                ? undefined
                : 'Copy it straight off your book. "-115", "+240".'
            }
          >
            <div
              className="flex items-center justify-between rounded-[14px] border px-4 py-4"
              style={{
                borderColor: oddsInvalid
                  ? "var(--danger-border)"
                  : "var(--input-border)",
                background: oddsInvalid ? "var(--danger-bg)" : "var(--card)",
              }}
            >
              <input
                value={oddsInput}
                onChange={(event) => setOddsInput(event.target.value)}
                placeholder="-115"
                inputMode="text"
                aria-invalid={oddsInvalid}
                aria-label="American odds"
                className="tabular min-w-0 flex-1 bg-transparent font-mono text-[22px] font-semibold outline-none placeholder:text-faint-2"
                style={{
                  color: oddsInvalid
                    ? "var(--ink-2)"
                    : odds !== null && odds < 0
                      ? "var(--cool)"
                      : odds !== null
                        ? "var(--accent)"
                        : "var(--ink-2)",
                }}
              />
              <span
                className="ml-3 font-mono text-[11px] whitespace-nowrap"
                style={{
                  color: oddsInvalid ? "var(--danger)" : "var(--faint)",
                }}
              >
                {oddsInvalid ? "not american" : "+/- required"}
              </span>
            </div>
            {oddsInvalid && <OddsError input={oddsInput} />}
          </Field>

          {after ? (
            <section className="flex flex-col gap-2.5 rounded-2xl border border-panel-line bg-panel p-4">
              <h2 className="label">What this does</h2>
              <div className="tabular flex items-baseline gap-2.5 font-mono">
                {before && (
                  <>
                    <span className="text-[22px] text-[#69727a]">
                      {formatAmericanOdds(before.american)}
                    </span>
                    <span className="text-sm text-faint-2">→</span>
                  </>
                )}
                <span className="text-[30px] font-semibold tracking-[-0.02em] text-accent">
                  {formatAmericanOdds(after.american)}
                </span>
              </div>
              <p className="text-[13px] text-muted-2">
                ${STAKE} would pay{" "}
                <span className="font-mono text-ink-3">
                  {formatMoney(after.payout)}
                </span>{" "}
                if it all hits.
              </p>
            </section>
          ) : (
            <section className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-[#22272b] bg-[#101315] p-4">
              <h2 className="font-mono text-[11px] tracking-[0.12em] text-faint-2 uppercase">
                What this does
              </h2>
              <p className="text-[13px] text-faint">
                {oddsInvalid
                  ? "Fix the odds and we'll show you the new number."
                  : "Add your odds and we'll show you the new number."}
              </p>
            </section>
          )}
        </form>

        <div className="flex flex-col gap-2.5 border-t border-hairline px-5 pt-4 pb-6">
          <button
            type="submit"
            form="add-leg"
            disabled={!canSubmit}
            className="h-[54px] rounded-2xl bg-accent text-base font-semibold text-app transition-opacity hover:opacity-90 disabled:bg-[#1c2126] disabled:text-faint disabled:opacity-100"
          >
            {pending ? "Locking…" : "Lock it in"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 text-sm text-muted-2 transition-colors hover:text-ink-3"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The most likely mistake is pasting decimal odds off a book set to decimal, so
 * name that specifically and show the American equivalent.
 */
function OddsError({ input }: { input: string }) {
  const asDecimal = Number(input.trim());
  const looksDecimal =
    Number.isFinite(asDecimal) && asDecimal > 1 && asDecimal < 100;
  const equivalent = looksDecimal
    ? asDecimal >= 2
      ? Math.round((asDecimal - 1) * 100)
      : Math.round(-100 / (asDecimal - 1))
    : null;

  return (
    <p className="text-[13px] leading-[1.4]" style={{ color: "var(--danger-text)" }}>
      {equivalent !== null ? (
        <>
          That&apos;s decimal odds. We need the American version —{" "}
          <span className="font-mono">{formatAmericanOdds(equivalent)}</span> for
          this one.
        </>
      ) : (
        <>
          Needs to be a whole number, <span className="font-mono">+100</span> or
          longer either way.
        </>
      )}
    </p>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-[9px]">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="font-mono text-[11px] text-faint">{hint}</span>}
    </label>
  );
}
