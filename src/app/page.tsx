import ParlayBoard from "@/components/ParlayBoard";
import { LEAGUE } from "@/lib/league";
import { listLegs, type Leg } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  let legs: Leg[] = [];
  let initialError: string | undefined;

  try {
    legs = await listLegs();
  } catch (cause) {
    // Usually a missing connection string or an un-applied schema. Render the
    // board anyway so the failure is legible instead of a crash page.
    initialError =
      cause instanceof Error ? cause.message : "Could not read the database.";
  }

  return (
    <ParlayBoard
      league={LEAGUE}
      initialLegs={legs}
      initialError={initialError}
    />
  );
}
