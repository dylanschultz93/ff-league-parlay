import type { Metadata } from "next";
import ManageBoard from "@/components/ManageBoard";
import PageShell from "@/components/PageShell";
import { describeDbError } from "@/lib/db";
import {
  getLeagueState,
  getParlay,
  listLegs,
  listParticipants,
  type LeagueState,
  type Parlay,
  type Participant,
} from "@/lib/store";

export const metadata: Metadata = { title: "Manage" };
export const dynamic = "force-dynamic";

export default async function ManagePage() {
  let participants: Participant[] = [];
  let parlay: Parlay = {
    locked: false,
    lockedAt: null,
    payer: null,
    payerReason: null,
  };
  let state: LeagueState | null = null;
  let legCount = 0;
  let initialError: string | undefined;

  try {
    // The leg count is only here so the week control can say what advancing
    // would leave behind.
    const [loadedParticipants, loadedParlay, loadedState, legs] =
      await Promise.all([
        listParticipants(),
        getParlay(),
        getLeagueState(),
        listLegs(),
      ]);
    participants = loadedParticipants;
    parlay = loadedParlay;
    state = loadedState;
    legCount = legs.length;
  } catch (cause) {
    // Same as the board: render the screen with the failure on it rather than
    // a crash page.
    initialError = describeDbError(cause);
  }

  return (
    <PageShell
      title="Manage"
      meta={state ? `Week ${state.week} · ${state.season} Season` : undefined}
      metaShort={state ? `Week ${state.week}` : undefined}
    >
      <ManageBoard
        initialState={state}
        initialLegCount={legCount}
        initialParticipants={participants}
        initialParlay={parlay}
        initialError={initialError}
      />
    </PageShell>
  );
}
