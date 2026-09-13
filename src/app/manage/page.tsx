import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import WireframeNote from "@/components/WireframeNote";
import { LEAGUE } from "@/lib/league";
import { PARTICIPANTS, type Participant } from "@/lib/wireframe";

export const metadata: Metadata = { title: "Manage" };

export default function ManagePage() {
  const active = PARTICIPANTS.filter((person) => person.active).length;

  return (
    <PageShell
      title="Manage"
      meta={`Week ${LEAGUE.week} · ${LEAGUE.season} Season`}
      metaShort={`Week ${LEAGUE.week}`}
    >
      <WireframeNote>
        Setting the week&apos;s payer and keeping the roster current — the two
        things still hardcoded in <code className="font-mono">league.ts</code>.
        Every control below is drawn, not wired.
      </WireframeNote>

      <Section
        title={`Who's paying · Week ${LEAGUE.week}`}
        hint="Normally last week's low scorer."
      >
        <div className="flex items-center gap-3 rounded-[14px] border border-[var(--accent-28)] bg-[var(--accent-11)] px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#20252a] font-mono text-[13px] font-semibold text-[#b9c2c8]">
            {(LEAGUE.payer ?? "?").charAt(0)}
          </span>
          <div className="flex min-w-0 flex-col gap-px">
            <span className="text-[15px] text-ink-2">
              {LEAGUE.payer ?? "Nobody set yet"}
            </span>
            <span className="font-mono text-[11px] text-muted-3">
              {LEAGUE.payerReason}
            </span>
          </div>
        </div>

        <Field label="Pick someone else">
          <div className="flex flex-wrap gap-2">
            {LEAGUE.roster.map((name) => (
              <span
                key={name}
                className={`rounded-full px-[15px] py-2.5 text-sm ${
                  name === LEAGUE.payer
                    ? "border border-[var(--accent-28)] bg-[var(--accent-11)] text-accent-soft"
                    : "border border-dashed border-dash text-muted-2"
                }`}
              >
                {name}
              </span>
            ))}
          </div>
        </Field>

        <Field label="Why they're paying">
          <input
            type="text"
            disabled
            defaultValue={LEAGUE.payerReason}
            className="h-[46px] w-full rounded-xl border border-input-line bg-transparent px-3.5 text-[15px] text-ink-3 disabled:opacity-60"
          />
        </Field>

        <InertButton label="Save the payer" primary />
      </Section>

      <Section
        title="Participants"
        hint={`${active} active · ${PARTICIPANTS.length - active} benched`}
      >
        <div className="flex gap-2">
          <input
            type="text"
            disabled
            placeholder="Add a name"
            className="h-[46px] min-w-0 flex-1 rounded-xl border border-input-line bg-transparent px-3.5 text-[15px] text-ink-3 placeholder:text-faint-2 disabled:opacity-60"
          />
          <InertButton label="Add" primary compact />
        </div>

        <ul className="flex flex-col gap-2">
          {PARTICIPANTS.map((person) => (
            <ParticipantRow key={person.name} person={person} />
          ))}
        </ul>

        <p className="font-mono text-[11px] text-muted-3">
          Benching keeps someone&apos;s past legs on the record but takes them
          off the week&apos;s waiting list. Removing drops them entirely.
        </p>
      </Section>
    </PageShell>
  );
}

function ParticipantRow({ person }: { person: Participant }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-[14px] border border-panel-line bg-panel px-3.5 py-3">
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
      <div className="flex shrink-0 items-center gap-4">
        <InertLink label={person.active ? "Bench" : "Restore"} />
        <InertLink label="Remove" danger />
      </div>
    </li>
  );
}

/** A titled block of the form. Same card treatment as the board's summary. */
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

/**
 * Drawn controls. They render as disabled buttons rather than live ones so the
 * screen reads as a wireframe from the keyboard too, not just by eye.
 */
function InertButton({
  label,
  primary,
  compact,
}: {
  label: string;
  primary?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      className={`flex h-[46px] items-center justify-center rounded-xl text-[15px] font-semibold opacity-60 ${
        compact ? "px-5" : "w-full"
      } ${primary ? "bg-accent text-app" : "border border-input-line text-muted"}`}
    >
      {label}
    </button>
  );
}

function InertLink({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled
      className={`font-mono text-[11px] opacity-70 ${
        danger ? "text-[#7d6a68]" : "text-[#69727a]"
      }`}
    >
      {label}
    </button>
  );
}
