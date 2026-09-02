"use client";

import { useMemo, useState } from "react";
import {
  STAKE,
  formatAmericanOdds,
  formatMoney,
  formatProbability,
  parseAmericanOdds,
  summarizeParlay,
} from "@/lib/odds";
import type { Leg } from "@/lib/store";

type League = {
  name: string;
  season: number;
  week: number;
  payer: string;
  roster: readonly string[];
};

export default function ParlayBoard({
  league,
  initialLegs,
}: {
  league: League;
  initialLegs: Leg[];
}) {
  const [legs, setLegs] = useState<Leg[]>(initialLegs);
  const [formOpen, setFormOpen] = useState(initialLegs.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submitted = useMemo(() => legs.map((leg) => leg.name), [legs]);
  const waiting = league.roster.filter((name) => !submitted.includes(name));
  const summary = summarizeParlay(legs.map((leg) => leg.odds));

  async function addLeg(name: string, pick: string, odds: number) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/legs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pick, odds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return false;
      }
      setLegs((current) => {
        const rest = current.filter((leg) => leg.id !== data.leg.id);
        return [...rest, data.leg];
      });
      setFormOpen(false);
      return true;
    } catch {
      setError("Could not reach the server.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function removeLeg(id: string) {
    const snapshot = legs;
    setLegs((current) => current.filter((leg) => leg.id !== id));
    const res = await fetch(`/api/legs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setLegs(snapshot);
      setError("Could not remove that leg.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{league.name}</h1>
        <p className="text-sm text-muted tabular">
          Week {league.week} · {league.season}
        </p>
      </header>

      <SummaryCard summary={summary} />

      <p className="text-sm text-muted">
        <span className="text-ink font-medium">{league.payer}</span> is paying
        this week
        <span className="text-muted"> · last place, Week {league.week - 1}</span>
      </p>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted tabular">
            {legs.length} of {league.roster.length} legs in
          </h2>
          <div className="flex gap-1">
            {league.roster.map((name, i) => (
              <span
                key={name}
                className={`h-1.5 w-4 rounded-full ${
                  i < legs.length ? "bg-accent" : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {legs.map((leg) => (
            <li
              key={leg.id}
              className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">
                  {leg.name}
                </p>
                <p className="mt-0.5 text-[15px] leading-snug break-words">
                  {leg.pick}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`tabular rounded-md px-2 py-1 text-sm font-semibold ${
                    leg.odds > 0
                      ? "bg-accent-dim text-accent"
                      : "bg-surface-raised text-negative"
                  }`}
                >
                  {formatAmericanOdds(leg.odds)}
                </span>
                <button
                  type="button"
                  onClick={() => removeLeg(leg.id)}
                  aria-label={`Remove ${leg.name}'s leg`}
                  className="rounded-md px-2 py-1 text-muted transition-colors hover:bg-surface-raised hover:text-ink"
                >
                  ×
                </button>
              </div>
            </li>
          ))}

          {waiting.map((name) => (
            <li
              key={name}
              className="flex items-center justify-between rounded-xl border border-dashed border-line px-4 py-3"
            >
              <span className="text-xs font-medium tracking-wide text-muted uppercase">
                {name}
              </span>
              <span className="text-xs text-muted">waiting</span>
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      {formOpen ? (
        <AddLegForm
          roster={league.roster}
          existingOdds={legs.map((leg) => leg.odds)}
          submitted={submitted}
          pending={pending}
          onCancel={legs.length > 0 ? () => setFormOpen(false) : undefined}
          onSubmit={addLeg}
        />
      ) : (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="sticky bottom-4 rounded-xl bg-accent px-4 py-3.5 text-[15px] font-semibold text-bg transition-opacity hover:opacity-90"
        >
          Add your leg
        </button>
      )}
    </div>
  );
}

function SummaryCard({
  summary,
}: {
  summary: ReturnType<typeof summarizeParlay>;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface px-5 py-6 text-center">
      <p className="text-xs font-medium tracking-widest text-muted uppercase">
        The parlay
      </p>
      <p
        className={`tabular mt-2 text-5xl font-bold tracking-tight ${
          summary ? "text-accent" : "text-muted"
        }`}
      >
        {summary ? formatAmericanOdds(summary.american) : "--"}
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4">
        <Stat label="Decimal" value={summary ? summary.decimal.toFixed(2) : "—"} />
        <Stat
          label="Win chance"
          value={summary ? formatProbability(summary.impliedProbability) : "—"}
        />
        <Stat
          label={`$${STAKE} pays`}
          value={summary ? formatMoney(summary.payout) : "—"}
        />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-muted uppercase">{label}</dt>
      <dd className="tabular mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function AddLegForm({
  roster,
  submitted,
  existingOdds,
  pending,
  onCancel,
  onSubmit,
}: {
  roster: readonly string[];
  submitted: string[];
  existingOdds: number[];
  pending: boolean;
  onCancel?: () => void;
  onSubmit: (name: string, pick: string, odds: number) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [pick, setPick] = useState("");
  const [oddsInput, setOddsInput] = useState("");
  const [touched, setTouched] = useState(false);

  const odds = parseAmericanOdds(oddsInput);
  const oddsInvalid = touched && oddsInput.trim() !== "" && odds === null;

  const before = summarizeParlay(existingOdds);
  const after = odds === null ? null : summarizeParlay([...existingOdds, odds]);

  const canSubmit =
    name !== "" && pick.trim() !== "" && odds !== null && !pending;

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!canSubmit) {
          setTouched(true);
          return;
        }
        const ok = await onSubmit(name, pick, odds);
        if (ok) {
          setName("");
          setPick("");
          setOddsInput("");
          setTouched(false);
        }
      }}
    >
      <Field label="Who are you?">
        <select
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-[15px]"
        >
          <option value="">Pick your name</option>
          {roster.map((option) => (
            <option key={option} value={option}>
              {option}
              {submitted.includes(option) ? " (replaces your leg)" : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Your leg">
        <textarea
          value={pick}
          onChange={(event) => setPick(event.target.value)}
          rows={2}
          placeholder="Ja'Marr Chase over 78.5 receiving yards"
          className="w-full resize-none rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-[15px] placeholder:text-muted"
        />
      </Field>

      <Field
        label="Odds"
        hint={oddsInvalid ? "Use American odds, like -115 or +250." : undefined}
      >
        <input
          value={oddsInput}
          onChange={(event) => setOddsInput(event.target.value)}
          onBlur={() => setTouched(true)}
          inputMode="text"
          placeholder="-115"
          aria-invalid={oddsInvalid}
          className={`tabular w-full rounded-lg border bg-surface-raised px-3 py-2.5 text-[15px] placeholder:text-muted ${
            oddsInvalid ? "border-negative" : "border-line"
          }`}
        />
      </Field>

      {after && (
        <p className="text-sm text-muted">
          This takes the parlay{" "}
          {before ? (
            <>
              from{" "}
              <span className="tabular text-ink">
                {formatAmericanOdds(before.american)}
              </span>{" "}
              to{" "}
            </>
          ) : (
            "to "
          )}
          <span className="tabular font-semibold text-accent">
            {formatAmericanOdds(after.american)}
          </span>
          .
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-[15px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Submitting…" : "Submit leg"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line px-4 py-3 text-[15px] text-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
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
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-negative">{hint}</span>}
    </label>
  );
}
