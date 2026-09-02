"use client";

import { useState } from "react";
import AddLegView from "@/components/AddLegView";
import LegCard from "@/components/LegCard";
import SummaryCard from "@/components/SummaryCard";
import { formatAmericanOdds, summarizeParlay } from "@/lib/odds";
import type { Leg } from "@/lib/store";

type League = {
  name: string;
  season: number;
  week: number;
  locksAt: string;
  payer: string | null;
  payerReason: string;
  roster: string[];
};

export default function ParlayBoard({
  league,
  initialLegs,
  initialError,
}: {
  league: League;
  initialLegs: Leg[];
  initialError?: string;
}) {
  const [legs, setLegs] = useState<Leg[]>(initialLegs);
  const [editing, setEditing] = useState<Leg | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const total = league.roster.length;
  const submittedNames = legs.map((leg) => leg.name);
  const waiting = league.roster.filter(
    (name) => !submittedNames.includes(name),
  );
  const summary = summarizeParlay(legs.map((leg) => leg.odds));
  const locked = legs.length === total;

  async function submitLeg(name: string, pick: string, odds: number) {
    setPending(true);
    setError(null);
    try {
      const res = editing
        ? await fetch(`/api/legs/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pick, odds }),
          })
        : await fetch("/api/legs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, pick, odds }),
          });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return false;
      }
      setLegs((current) => [
        ...current.filter((leg) => leg.id !== data.leg.id),
        data.leg,
      ]);
      closeForm();
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

  function openForm(leg: Leg | null) {
    setEditing(leg);
    setFormOpen(true);
    setError(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  const oneLegNote =
    legs.length === 1 ? `Just ${legs[0].name} so far — the parlay is their leg.` : undefined;
  const emptyNote = legs.length === 0 ? "Nobody's in yet. First leg sets the line." : undefined;

  const cta = locked
    ? "Change a leg"
    : legs.length === 0
      ? "Be first — add your leg"
      : "Add your leg";

  return (
    <>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-10 border-b border-hairline bg-app px-5 pt-[22px] pb-3.5 lg:px-10 lg:py-[22px]">
          <div className="mx-auto flex w-full max-w-[1280px] items-baseline justify-between">
            <div className="flex items-baseline gap-4">
              <span className="text-[19px] font-bold tracking-[-0.02em] text-ink lg:text-[22px]">
                {league.name}
              </span>
              <span className="hidden font-mono text-[13px] text-muted lg:inline">
                Week {league.week} · {league.season} Season
              </span>
            </div>
            <span className="font-mono text-xs text-muted lg:hidden">
              Week {league.week} · {league.season}
            </span>
            <button
              type="button"
              onClick={() => openForm(null)}
              className="hidden h-[42px] rounded-xl bg-accent px-[22px] text-[15px] font-semibold text-app transition-opacity hover:opacity-90 lg:block"
            >
              {cta}
            </button>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-[1280px] flex-1 items-start gap-[18px] px-5 pt-[18px] pb-[130px] lg:grid-cols-[420px_1fr] lg:gap-8 lg:px-10 lg:pt-8 lg:pb-11">
          <div className="flex min-w-0 flex-col gap-[18px] lg:sticky lg:top-[104px]">
            {locked && (
              <p className="rounded-xl border border-[var(--accent-28)] bg-[var(--accent-11)] px-4 py-3 font-mono text-[11px] tracking-[0.12em] text-accent-soft uppercase">
                Locked and loaded · {total} of {total}
              </p>
            )}

            <SummaryCard
              summary={summary}
              locked={locked}
              note={emptyNote ?? oneLegNote}
            />

            {league.payer && (
              <div className="flex items-center gap-2.5 px-0.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#20252a] font-mono text-[11px] font-semibold text-[#b9c2c8]">
                  {league.payer.charAt(0)}
                </span>
                <div className="flex flex-col gap-px">
                  <span className="text-sm text-ink-3">
                    {league.payer}
                    {locked ? "'s already paid up" : "'s tab this week"}
                  </span>
                  <span className="font-mono text-[11px] text-muted-3">
                    {league.payerReason}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="text-[13px]"
                style={{ color: "var(--danger-text)" }}
              >
                {error}
              </p>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-[18px]">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xs tracking-[0.1em] text-muted uppercase">
                  {legs.length} of {total} in
                </span>
                <span className="font-mono text-xs text-muted-3">
                  {locked
                    ? "all in"
                    : legs.length === 0
                      ? league.locksAt
                      : `${waiting.length} to go`}
                </span>
              </div>
              <div className="flex gap-[5px]">
                {league.roster.map((name, i) => (
                  <span
                    key={name}
                    className="h-[5px] flex-1 rounded-[3px]"
                    style={{
                      background:
                        i < legs.length ? "var(--accent)" : "var(--track)",
                    }}
                  />
                ))}
              </div>
            </div>

            {legs.length > 0 && (
              <ul className="flex flex-col gap-2">
                {legs.map((leg) => (
                  <LegCard
                    key={leg.id}
                    leg={leg}
                    onEdit={() => openForm(leg)}
                    onRemove={() => removeLeg(leg.id)}
                  />
                ))}
              </ul>
            )}

            {waiting.length > 0 && (
              <div className="flex flex-col gap-2">
                <h2 className="pl-0.5 font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
                  {legs.length === 0
                    ? `Waiting on all ${total}`
                    : "Still waiting on"}
                </h2>
                {legs.length === 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {waiting.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-dashed border-dash px-[15px] py-2.5 text-sm text-muted-2"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {waiting.map((name) => (
                      <li
                        key={name}
                        className="flex items-center justify-between rounded-[14px] border border-dashed border-dash px-3.5 py-3"
                      >
                        <span className="text-[15px] text-muted-2">{name}</span>
                        <span className="font-mono text-xs text-faint-2">
                          nudge
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {locked && summary && (
              <p className="font-mono text-xs text-muted-3">
                Final ticket: {formatAmericanOdds(summary.american)} across{" "}
                {total} legs.
              </p>
            )}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-app from-[62%] to-transparent px-5 pt-[18px] pb-6 lg:hidden">
          <button
            type="button"
            onClick={() => openForm(null)}
            className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-accent text-base font-semibold text-app transition-opacity active:opacity-90"
          >
            {cta}
          </button>
        </div>
      </div>

      {formOpen && (
        <AddLegView
          roster={league.roster}
          submittedNames={submittedNames}
          legs={legs}
          week={league.week}
          editing={editing}
          pending={pending}
          onCancel={closeForm}
          onSubmit={submitLeg}
        />
      )}
    </>
  );
}
