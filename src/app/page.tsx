import ParlayBoard from "@/components/ParlayBoard";
import { LEAGUE } from "@/lib/league";
import { describeDbError } from "@/lib/db";
import { getParlay, listLegs, type Leg, type Parlay } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  let legs: Leg[] = [];
  let parlay: Parlay = { locked: false, lockedAt: null };
  let initialError: string | undefined;

  try {
    [legs, parlay] = await Promise.all([listLegs(), getParlay()]);
  } catch (cause) {
    // Usually a missing connection string or an un-applied schema. Render the
    // board anyway so the failure is legible instead of a crash page.
    initialError = describeDbError(cause);
  }

  return (
    <ParlayBoard
      league={LEAGUE}
      initialLegs={legs}
      initialParlay={parlay}
      initialError={initialError}
    />
  );
}
