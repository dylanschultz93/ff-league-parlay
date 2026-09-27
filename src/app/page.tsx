import ParlayBoard from "@/components/ParlayBoard";
import { isAdmin } from "@/lib/admin";
import { LEAGUE } from "@/lib/league";
import { describeDbError } from "@/lib/db";
import {
  getLeagueState,
  getParlay,
  listLegs,
  listParticipants,
  listPhones,
  type Leg,
  type LeagueState,
  type Parlay,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  let legs: Leg[] = [];
  let parlay: Parlay = {
    locked: false,
    lockedAt: null,
    payer: null,
    payerReason: null,
  };
  let roster: string[] = [];
  let state: LeagueState | null = null;
  // Only a device that has entered ADMIN_KEY gets numbers, and so only it can
  // nudge by text. Everyone else's nudge uses the share sheet.
  let phones: Record<string, string> = {};
  let initialError: string | undefined;

  try {
    const [loadedLegs, loadedParlay, participants, loadedState] =
      await Promise.all([
        listLegs(),
        getParlay(),
        listParticipants(),
        getLeagueState(),
      ]);
    legs = loadedLegs;
    parlay = loadedParlay;
    state = loadedState;
    // Benched people aren't waited on — they're off this week by definition.
    const active = participants.filter((person) => person.active);
    roster = active.map((person) => person.name);
    if (await isAdmin()) {
      const byId = await listPhones();
      phones = Object.fromEntries(
        active
          .filter((person) => byId[person.id])
          .map((person) => [person.name, byId[person.id]]),
      );
    }
  } catch (cause) {
    // Usually a missing connection string or an un-applied schema. Render the
    // board anyway so the failure is legible instead of a crash page.
    initialError = describeDbError(cause);
  }

  return (
    <ParlayBoard
      league={LEAGUE}
      state={state}
      roster={roster}
      phones={phones}
      initialLegs={legs}
      initialParlay={parlay}
      initialError={initialError}
    />
  );
}
