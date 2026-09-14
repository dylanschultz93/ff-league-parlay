"use client";

import { useState } from "react";
import type { Participant, Parlay } from "@/lib/store";

/**
 * The two things about the league that change: who's covering this week's $10,
 * and who's on the list at all. Both used to be constants in league.ts.
 *
 * There's no auth here, same as everywhere else — anyone with the link can
 * bench anyone. Removal is the one move that loses something, so it asks first.
 */
export default function ManageBoard({
  week,
  initialParticipants,
  initialParlay,
  initialError,
}: {
  week: number;
  initialParticipants: Participant[];
  initialParlay: Parlay;
  initialError?: string;
}) {
  const [participants, setParticipants] =
    useState<Participant[]>(initialParticipants);
  const [parlay, setParlay] = useState<Parlay>(initialParlay);

  // The payer form is a draft until it's saved — picking a name shouldn't put
  // someone on the hook before whoever's typing has written down why.
  const [payerDraft, setPayerDraft] = useState<string | null>(
    initialParlay.payer,
  );
  const [reasonDraft, setReasonDraft] = useState(
    initialParlay.payerReason ?? "",
  );
  const [saved, setSaved] = useState(false);

  const [newName, setNewName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const active = participants.filter((person) => person.active);
  const benched = participants.length - active.length;

  const payerDirty =
    payerDraft !== parlay.payer ||
    reasonDraft.trim() !== (parlay.payerReason ?? "");
  // Someone can be benched or removed after they were put on the hook. Their
  // name stays on the week either way — the debt doesn't lapse.
  const payerOffRoster =
    parlay.payer !== null &&
    !active.some((person) => person.name === parlay.payer);

  /** Every write goes through here so one failure path covers the screen. */
  async function send(
    url: string,
    init: RequestInit,
  ): Promise<Record<string, unknown> | null> {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      if (res.status === 204) return {};
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Something went wrong.");
        return null;
      }
      return data as Record<string, unknown>;
    } catch {
      setError("Could not reach the server.");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function savePayer(payer: string | null) {
    const data = await send("/api/parlay", {
      method: "PATCH",
      body: JSON.stringify({
        payer,
        payerReason: payer === null ? null : reasonDraft.trim() || null,
      }),
    });
    if (!data) return;
    const next = data.parlay as Parlay;
    setParlay(next);
    setPayerDraft(next.payer);
    setReasonDraft(next.payerReason ?? "");
    setSaved(true);
  }

  async function addPerson(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (name === "") return;
    const data = await send("/api/participants", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (!data) return;
    const added = data.participant as Participant;
    setParticipants((current) => byName([...current, added]));
    setNewName("");
  }

  async function setActive(person: Participant, active: boolean) {
    const snapshot = participants;
    setParticipants((current) =>
      current.map((p) => (p.id === person.id ? { ...p, active } : p)),
    );
    const data = await send(`/api/participants/${person.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    });
    if (!data) setParticipants(snapshot);
  }

  async function remove(person: Participant) {
    setConfirmingId(null);
    const snapshot = participants;
    setParticipants((current) => current.filter((p) => p.id !== person.id));
    const data = await send(`/api/participants/${person.id}`, {
      method: "DELETE",
    });
    if (!data) setParticipants(snapshot);
  }

  return (
    <>
      {error && (
        <p
          role="alert"
          className="text-[13px]"
          style={{ color: "var(--danger-text)" }}
        >
          {error}
        </p>
      )}

      <Section
        title={`Who's paying · Week ${week}`}
        hint="Normally last week's low scorer."
      >
        <div
          className="flex items-center gap-3 rounded-[14px] border px-4 py-3.5"
          style={{
            borderColor: parlay.payer ? "var(--accent-28)" : "var(--dash)",
            background: parlay.payer ? "var(--accent-11)" : "transparent",
          }}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#20252a] font-mono text-[13px] font-semibold text-[#b9c2c8]">
            {parlay.payer ? parlay.payer.charAt(0) : "—"}
          </span>
          <div className="flex min-w-0 flex-col gap-px">
            <span
              className={`text-[15px] ${parlay.payer ? "text-ink-2" : "text-muted-2"}`}
            >
              {parlay.payer ?? "Nobody's on the hook yet"}
            </span>
            <span className="font-mono text-[11px] text-muted-3">
              {parlay.payer
                ? (parlay.payerReason ?? "No reason given.")
                : "Pick someone below."}
            </span>
          </div>
        </div>

        {payerOffRoster && (
          <p className="font-mono text-[11px] text-muted-3">
            {parlay.payer} isn&apos;t on the active roster any more. They still
            owe this week.
          </p>
        )}

        <Field label={parlay.payer ? "Pick someone else" : "Pick someone"}>
          {active.length === 0 ? (
            <p className="text-[13px] text-muted-2">
              Nobody&apos;s active — add someone below first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {active.map((person) => {
                const picked = person.name === payerDraft;
                return (
                  <button
                    key={person.id}
                    type="button"
                    aria-pressed={picked}
                    onClick={() => {
                      setPayerDraft(picked ? null : person.name);
                      setSaved(false);
                    }}
                    className={`rounded-full px-[15px] py-2.5 text-sm transition-colors ${
                      picked
                        ? "border border-[var(--accent-28)] bg-[var(--accent-11)] text-accent-soft"
                        : "border border-dashed border-dash text-muted-2 hover:text-ink-3"
                    }`}
                  >
                    {person.name}
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        <Field label="Why they're paying">
          <input
            type="text"
            value={reasonDraft}
            onChange={(event) => {
              setReasonDraft(event.target.value);
              setSaved(false);
            }}
            placeholder="Finished last. Rough."
            className="h-[46px] w-full rounded-xl border border-input-line bg-transparent px-3.5 text-[15px] text-ink-2 placeholder:text-faint-2 focus:border-[var(--accent-50)] focus:outline-none"
          />
        </Field>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => savePayer(payerDraft)}
            disabled={pending || !payerDirty || payerDraft === null}
            className="flex h-[46px] flex-1 items-center justify-center rounded-xl bg-accent text-[15px] font-semibold text-app transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save the payer"}
          </button>
          {parlay.payer !== null && (
            <button
              type="button"
              onClick={() => savePayer(null)}
              disabled={pending}
              className="font-mono text-[11px] text-muted-3 underline underline-offset-4 transition-colors hover:text-ink-3 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
        {saved && !payerDirty && (
          <p className="font-mono text-[11px] text-accent-soft">
            Saved. The board shows it now.
          </p>
        )}
      </Section>

      <Section
        title="Participants"
        hint={`${active.length} active${benched > 0 ? ` · ${benched} benched` : ""}`}
      >
        <form onSubmit={addPerson} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Add a name"
            maxLength={40}
            className="h-[46px] min-w-0 flex-1 rounded-xl border border-input-line bg-transparent px-3.5 text-[15px] text-ink-2 placeholder:text-faint-2 focus:border-[var(--accent-50)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || newName.trim() === ""}
            className="h-[46px] shrink-0 rounded-xl bg-accent px-5 text-[15px] font-semibold text-app transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Add
          </button>
        </form>

        {participants.length === 0 ? (
          <p className="text-[13px] text-muted-2">
            Nobody on the list yet. Whoever you add here is who the board waits
            on.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {participants.map((person) => (
              <li
                key={person.id}
                className="flex items-center justify-between gap-3 rounded-[14px] border border-panel-line bg-panel px-3.5 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{
                      background: person.active ? "var(--accent)" : "var(--dim)",
                    }}
                  />
                  <span
                    className={`truncate text-[15px] ${
                      person.active ? "text-ink-2" : "text-muted-3"
                    }`}
                  >
                    {person.name}
                  </span>
                </div>

                {confirmingId === person.id ? (
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-[11px] text-muted-3">
                      Remove?
                    </span>
                    <RowButton
                      label="Yes"
                      danger
                      onClick={() => remove(person)}
                      disabled={pending}
                    />
                    <RowButton
                      label="Cancel"
                      onClick={() => setConfirmingId(null)}
                    />
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-4">
                    <RowButton
                      label={person.active ? "Bench" : "Restore"}
                      onClick={() => setActive(person, !person.active)}
                      disabled={pending}
                    />
                    <RowButton
                      label="Remove"
                      danger
                      onClick={() => setConfirmingId(person.id)}
                      disabled={pending}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="font-mono text-[11px] text-muted-3">
          Benching takes someone off the week&apos;s waiting list and keeps
          their legs on the record. Removing takes them off the list for good —
          their past legs stay, and it&apos;s refused while they have a leg on
          this week&apos;s board.
        </p>
      </Section>
    </>
  );
}

/** Server order, kept locally so an added name doesn't land at the bottom. */
function byName(people: Participant[]): Participant[] {
  return [...people].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[22px] border border-card-line bg-card px-4 pt-[18px] pb-5 lg:px-[26px] lg:pt-6 lg:pb-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-mono text-[11px] tracking-[0.16em] text-[#7a838b] uppercase">
          {title}
        </h2>
        <p className="text-[13px] text-muted-2">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="pl-0.5 font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function RowButton({
  label,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`font-mono text-[11px] transition-colors disabled:opacity-50 ${
        danger
          ? "text-[#69727a] hover:text-danger-text"
          : "text-[#69727a] hover:text-ink-3"
      }`}
    >
      {label}
    </button>
  );
}
