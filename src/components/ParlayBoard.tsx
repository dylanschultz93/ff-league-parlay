"use client";

import { useMemo, useState } from "react";
import AddLegView from "@/components/AddLegView";
import AppHeader from "@/components/AppHeader";
import LegCard from "@/components/LegCard";
import LockControls from "@/components/LockControls";
import SummaryCard from "@/components/SummaryCard";
import { formatAmericanOdds, summarizeParlay } from "@/lib/odds";
import { bustedOn, gradedCount, parlayStatus } from "@/lib/parlay";
import type { ParlayStatus } from "@/lib/parlay";
import type { Leg, LegResult, Parlay } from "@/lib/store";

type League = {
  name: string;
  season: number;
  week: number;
  locksAt: string;
};

export default function ParlayBoard({
  league,
  roster,
  initialLegs,
  initialParlay,
  initialError,
}: {
  league: League;
  /** Active participants, from the database. Managed on /manage. */
  roster: string[];
  initialLegs: Leg[];
  initialParlay: Parlay;
  initialError?: string;
}) {
  const [legs, setLegs] = useState<Leg[]>(initialLegs);
  const [parlay, setParlay] = useState<Parlay>(initialParlay);
  const [editing, setEditing] = useState<Leg | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const total = roster.length;
  const submittedNames = legs.map((leg) => leg.name);

  // Both name lists on the board read alphabetically. The roster arrives that
  // way; legs are sorted here so one doesn't jump to the bottom after an edit.
  const byName = (a: string, b: string) => a.localeCompare(b);
  const sortedLegs = useMemo(
    () => [...legs].sort((a, b) => byName(a.name, b.name)),
    [legs],
  );
  const waiting = roster
    .filter((name) => !submittedNames.includes(name))
    .sort(byName);
  const summary = summarizeParlay(legs.map((leg) => leg.odds));

  const locked = parlay.locked;
  const status = parlayStatus(legs, locked);
  const graded = gradedCount(legs);
  const busted = bustedOn(sortedLegs);

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
        // Someone else locked the week while this form was open — reflect it
        // so the board stops offering edits that will be refused.
        if (res.status === 409)
          setParlay((current) => ({ ...current, locked: true }));
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

  /** Mark a leg won or lost, or pass null to put it back to ungraded. */
  async function gradeLeg(id: string, result: LegResult | null) {
    const snapshot = legs;
    setError(null);
    setLegs((current) =>
      current.map((leg) => (leg.id === id ? { ...leg, result } : leg)),
    );
    try {
      const res = await fetch(`/api/legs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLegs(snapshot);
        setError(data.error ?? "Could not save that result.");
      }
    } catch {
      setLegs(snapshot);
      setError("Could not reach the server.");
    }
  }

  async function setLocked(next: boolean) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/parlay", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not change the lock.");
        return;
      }
      setParlay(data.parlay);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
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
    legs.length === 1 && !locked
      ? `Just ${legs[0].name} so far — the parlay is their leg.`
      : undefined;
  const emptyNote = legs.length === 0 ? "Nobody's in yet. First leg sets the line." : undefined;

  // Once everyone is in there is nothing to add, and once the ticket is placed
  // nothing can change at all — either way the CTA comes off the page.
  const everyoneIn = waiting.length === 0;
  const canAdd = !locked && !everyoneIn;
  const cta = legs.length === 0 ? "Be first — add your leg" : "Add your leg";

  return (
    <>
      <div className="flex min-h-dvh flex-col">
        <AppHeader
          title={league.name}
          meta={`Week ${league.week} · ${league.season} Season`}
          metaShort={`Week ${league.week} · ${league.season}`}
          action={
            canAdd ? (
              <button
                type="button"
                onClick={() => openForm(null)}
                className="hidden h-[42px] rounded-xl bg-accent px-[22px] text-[15px] font-semibold text-app transition-opacity hover:opacity-90 lg:block"
              >
                {cta}
              </button>
            ) : undefined
          }
        />

        {/* content-start below lg: the grid is flex-1, so on a short board —
            a locked week with no waiting list — stretched rows would open a
            gap between the summary and the legs. */}
        <div
          className={`mx-auto grid w-full max-w-[1280px] flex-1 content-start items-start gap-[18px] px-5 pt-[18px] lg:grid-cols-[420px_1fr] lg:content-normal lg:gap-8 lg:px-10 lg:pt-8 lg:pb-11 ${
            canAdd ? "pb-[130px]" : "pb-10"
          }`}
        >
          <div className="flex min-w-0 flex-col gap-[18px] lg:sticky lg:top-[143px]">
            <StatusBanner
              status={status}
              legCount={legs.length}
              graded={graded}
              bustedName={busted?.name}
            />

            <SummaryCard
              summary={summary}
              status={status}
              note={emptyNote ?? oneLegNote}
            />

            <LockControls
              status={status}
              legCount={legs.length}
              graded={graded}
              pending={pending}
              onLock={() => setLocked(true)}
              onUnlock={() => setLocked(false)}
            />

            {parlay.payer && (
              <div className="flex items-center gap-2.5 px-0.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#20252a] font-mono text-[11px] font-semibold text-[#b9c2c8]">
                  {parlay.payer.charAt(0)}
                </span>
                <div className="flex flex-col gap-px">
                  <span className="text-sm text-ink-3">
                    {parlay.payer}
                    {locked ? "'s already paid up" : "'s tab this week"}
                  </span>
                  {parlay.payerReason && (
                    <span className="font-mono text-[11px] text-muted-3">
                      {parlay.payerReason}
                    </span>
                  )}
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
                  {locked
                    ? `${legs.length} ${legs.length === 1 ? "leg" : "legs"} on the ticket`
                    : `${legs.length} of ${total} in`}
                </span>
                <span className="font-mono text-xs text-muted-3">
                  {locked
                    ? `${graded} of ${legs.length} graded`
                    : legs.length === 0
                      ? league.locksAt
                      : everyoneIn
                        ? "all in"
                        : `${waiting.length} to go`}
                </span>
              </div>
              <ProgressBar
                legs={sortedLegs}
                total={total}
                locked={locked}
              />
            </div>

            {legs.length > 0 && (
              <ul className="flex flex-col gap-2">
                {sortedLegs.map((leg) => (
                  <LegCard
                    key={leg.id}
                    leg={leg}
                    locked={locked}
                    onEdit={() => openForm(leg)}
                    onRemove={() => removeLeg(leg.id)}
                    onGrade={(result) => gradeLeg(leg.id, result)}
                  />
                ))}
              </ul>
            )}

            {/* Once the ticket is placed, whoever didn't submit simply missed
                it — a "still waiting on" list would be asking for nothing. */}
            {!locked && waiting.length > 0 && (
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
                {legs.length} {legs.length === 1 ? "leg" : "legs"}.
                {status === "live" && graded < legs.length
                  ? " Mark each leg as it settles."
                  : ""}
              </p>
            )}
          </div>
        </div>

        {canAdd && (
          <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-app from-[62%] to-transparent px-5 pt-[18px] pb-6 lg:hidden">
            <button
              type="button"
              onClick={() => openForm(null)}
              className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-accent text-base font-semibold text-app transition-opacity active:opacity-90"
            >
              {cta}
            </button>
          </div>
        )}
      </div>

      {formOpen && (
        <AddLegView
          availableNames={waiting}
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

/**
 * The lock/settle headline. Before the lock there is nothing to say that the
 * progress row doesn't already say.
 */
function StatusBanner({
  status,
  legCount,
  graded,
  bustedName,
}: {
  status: ParlayStatus;
  legCount: number;
  graded: number;
  bustedName?: string;
}) {
  if (status === "open") return null;

  const lost = status === "lost";
  const text =
    status === "live"
      ? `Locked and loaded · ${graded} of ${legCount} graded`
      : lost
        ? bustedName
          ? `Dead ticket · ${bustedName}'s leg missed`
          : "Dead ticket"
        : `Cashed · all ${legCount} hit`;

  return (
    <p
      className="flex items-center gap-2 rounded-xl border px-4 py-3 font-mono text-[11px] tracking-[0.12em] uppercase"
      style={{
        borderColor: lost ? "var(--loss-25)" : "var(--accent-28)",
        background: lost ? "var(--loss-12)" : "var(--accent-11)",
        color: lost ? "var(--loss)" : "var(--accent-soft)",
      }}
    >
      <span
        aria-hidden
        className="h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: lost ? "var(--loss)" : "var(--accent)" }}
      />
      {text}
    </p>
  );
}

/**
 * One segment per roster spot while legs come in; once locked the roster no
 * longer matters, so the bar becomes one segment per placed leg, coloured by
 * how it finished.
 */
function ProgressBar({
  legs,
  total,
  locked,
}: {
  legs: Leg[];
  total: number;
  locked: boolean;
}) {
  const segments = locked
    ? legs.map((leg) => ({
        key: leg.id,
        color:
          leg.result === "won"
            ? "var(--accent)"
            : leg.result === "lost"
              ? "var(--loss)"
              : "var(--track)",
      }))
    : Array.from({ length: total }, (_, i) => ({
        key: `slot-${i}`,
        color: i < legs.length ? "var(--accent)" : "var(--track)",
      }));

  return (
    <div className="flex gap-[5px]">
      {segments.map((segment) => (
        <span
          key={segment.key}
          className="h-[5px] flex-1 rounded-[3px]"
          style={{ background: segment.color }}
        />
      ))}
    </div>
  );
}
