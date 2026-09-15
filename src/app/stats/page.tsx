import type { Metadata } from "next";
import Link from "next/link";
import EmptyNote from "@/components/EmptyNote";
import LoadError from "@/components/LoadError";
import PageShell from "@/components/PageShell";
import StatTile from "@/components/StatTile";
import {
  DEFAULT_SORT,
  SORTS,
  isSortKey,
  rank,
  statFor,
  summarizeWeek,
  totalsFor,
  type PersonStat,
  type SortKey,
} from "@/lib/archive";
import { describeDbError } from "@/lib/db";
import { formatAmericanOdds } from "@/lib/odds";
import {
  getLeagueState,
  listArchivedWeeks,
  listRecords,
  type LeagueState,
} from "@/lib/store";

export const metadata: Metadata = { title: "Stats" };
export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { sort } = await searchParams;
  const active: SortKey = isSortKey(sort) ? sort : DEFAULT_SORT;

  let people: PersonStat[] = [];
  let settledWeeks = 0;
  let state: LeagueState | null = null;
  let error: string | undefined;

  try {
    const [records, archived, loadedState] = await Promise.all([
      listRecords(),
      listArchivedWeeks(),
      getLeagueState(),
    ]);
    people = records.map(statFor);
    settledWeeks = totalsFor(archived.map(summarizeWeek)).settledWeeks;
    state = loadedState;
  } catch (cause) {
    error = describeDbError(cause);
  }

  const ranked = rank(people, active);
  const totalLegs = people.reduce((sum, person) => sum + person.legs, 0);
  const totalGraded = people.reduce((sum, person) => sum + person.graded, 0);
  const totalWon = people.reduce((sum, person) => sum + person.won, 0);
  // Everyone on the roster shows up from the first week, legs or not, so an
  // empty list means the league itself is empty rather than the season young.
  const nothingYet = totalLegs === 0;

  return (
    <PageShell
      title="Stats"
      meta={state === null ? undefined : `${state.season} Season`}
      metaShort={state === null ? undefined : `${state.season}`}
    >
      {error && <LoadError message={error} />}

      {!error && ranked.length === 0 && (
        <EmptyNote>
          Nobody on the list yet. Add the league on the manage screen and their
          records start here.
        </EmptyNote>
      )}

      {ranked.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2.5 lg:gap-3">
            <StatTile label="Legs" value={`${totalLegs}`} />
            <StatTile
              label="Hit rate"
              value={
                totalGraded === 0
                  ? "—"
                  : `${Math.round((totalWon / totalGraded) * 100)}%`
              }
            />
            <StatTile label="Weeks" value={`${settledWeeks}`} />
          </div>

          {nothingYet && (
            <EmptyNote>
              No legs on the record yet — the table below is the roster waiting
              to be filled in.
            </EmptyNote>
          )}

          <div className="flex flex-col gap-2">
            <span className="pl-0.5 font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
              Sort by
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SORTS).map(([key, label]) => (
                <SortChip
                  key={key}
                  sort={key as SortKey}
                  label={label}
                  active={key === active}
                />
              ))}
            </div>
          </div>

          <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-2.5">
            {ranked.map((person, i) => (
              <PersonRow key={person.name} person={person} rank={i + 1} />
            ))}
          </ul>

          {totalGraded < totalLegs && (
            <p className="font-mono text-xs text-muted-3">
              A record counts graded legs only. A parlay dies on its first
              loser, so the legs behind one often never get a result —{" "}
              {totalLegs - totalGraded} of {totalLegs} are still ungraded.
            </p>
          )}
        </>
      )}
    </PageShell>
  );
}

/**
 * A link, not a button: the sort is the URL, so the whole screen is a server
 * render either way and the order survives a refresh or a shared link.
 */
function SortChip({
  sort,
  label,
  active,
}: {
  sort: SortKey;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={sort === DEFAULT_SORT ? "/stats" : `/stats?sort=${sort}`}
      aria-current={active ? "true" : undefined}
      scroll={false}
      className={`rounded-full px-3.5 py-2 font-mono text-[11px] transition-colors ${
        active
          ? "border border-[var(--accent-28)] bg-[var(--accent-11)] text-accent-soft"
          : "border border-dash text-muted-3 hover:text-ink-3"
      }`}
    >
      {label}
    </Link>
  );
}

function PersonRow({ person, rank }: { person: PersonStat; rank: number }) {
  const pct = Math.round(person.hitRate * 100);

  return (
    <li className="flex items-center gap-3.5 rounded-2xl border border-panel-line bg-panel px-3.5 py-3">
      <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#20252a] font-mono text-[11px] font-semibold text-[#b9c2c8]">
        {rank}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[15px] text-ink-2">
              {person.name}
            </span>
            <RosterMark active={person.active} />
          </span>
          <span className="tabular shrink-0 font-mono text-sm font-semibold text-ink-3">
            {person.won}–{person.lost}
          </span>
        </div>

        <div
          className="h-[5px] w-full overflow-hidden rounded-[3px]"
          style={{ background: "var(--track)" }}
        >
          <div
            className="h-full rounded-[3px]"
            style={{
              width: `${person.graded === 0 ? 0 : pct}%`,
              background: pct >= 50 ? "var(--accent)" : "var(--loss)",
            }}
          />
        </div>

        <span className="tabular font-mono text-[11px] text-muted-3">
          {person.graded === 0 ? "no legs graded" : `${pct}% hit`}
          {person.avgOdds !== null && ` · avg ${formatAmericanOdds(person.avgOdds)}`}
          {person.longestOdds !== null &&
            ` · best ${formatAmericanOdds(person.longestOdds)}`}
          {person.weeksPaid > 0 && ` · paid ${person.weeksPaid}×`}
        </span>
      </div>
    </li>
  );
}

/**
 * Legs carry a name rather than a foreign key, so someone can hold a record
 * here after coming off the roster. Say which, instead of showing a name the
 * board no longer offers with nothing to explain it.
 */
function RosterMark({ active }: { active: boolean | null }) {
  if (active === true) return null;
  return (
    <span className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-faint-2 uppercase">
      {active === false ? "Benched" : "Off the list"}
    </span>
  );
}
