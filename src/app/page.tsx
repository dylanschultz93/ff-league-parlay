import ParlayBoard from "@/components/ParlayBoard";
import { LEAGUE } from "@/lib/league";
import { describeDbError } from "@/lib/db";
import {
  getParlay,
  listLegs,
  listParticipants,
  type Leg,
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
  let initialError: string | undefined;

  try {
    const [loadedLegs, loadedParlay, participants] = await Promise.all([
      listLegs(),
      getParlay(),
      listParticipants(),
    ]);
    legs = loadedLegs;
    parlay = loadedParlay;
    // Benched people aren't waited on — they're off this week by definition.
    roster = participants
      .filter((person) => person.active)
      .map((person) => person.name);
  } catch (cause) {
    // Usually a missing connection string or an un-applied schema. Render the
    // board anyway so the failure is legible instead of a crash page.
    initialError = describeDbError(cause);
  }

  return (
    <ParlayBoard
      league={LEAGUE}
      roster={roster}
      initialLegs={legs}
      initialParlay={parlay}
      initialError={initialError}
    />
  );
}
